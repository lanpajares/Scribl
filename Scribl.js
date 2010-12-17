


	function Scribl(canvas, width) {

		// create canvas contexts
		var ctx = canvas.getContext("2d");  
		
		// chart defaults
		this.trackSizes = 70;	
		this.trackBuffer = 5;
		this.scale = {};
		this.scale.pretty = true;
		this.scale.max = undefined;
		this.scale.min = undefined;
		this.scale.max_min = {};
		this.scale.max_min.auto = true;
		this.scale.offset = false
		this.scale.off = false;
		this.scale.size = 15;
		this.scale.units = "";
		this.scale.font = {};
		this.scale.font.size = 15;
		this.scale.font.color = "black";
		this.canvas = canvas;
		this.ctx = ctx;
		this.width = width;
		
		// tick defaults
		this.tick = {};
		this.tick.major = {};
		this.tick.major.size = 100;
		this.tick.major.color = "black";
		this.tick.minor = {};
		this.tick.minor.size = 10;
		this.tick.minor.color = "rgb(55,55,55)";
		this.tick.halfColor = "rgb(10,10,10)";
		
		// private variables
		var tracks = [];
		this.tracks = tracks;
		var scaleSize = this.scale.size;
		var scaleFontSize = this.scale.font.size
		
		// get the pixels/nt  TODO: Rename to pixelPerNt and fix elsewhere
		this.percentScale = function() { return (this.width / ( this.scale.max - this.scale.min) ); }
		
		// gets the nts/pixel
		this.ntsPerPixel = function(nts) { 
			if (nts == undefined) 
				return ( 1 / this.percentScale() );
			else
				return ( nts / this.width );
		}
		this.scale.trackSize = function() { return ( this.size + this.font.size ); }
			
		// add a new track to the chart
		this.addTrack = function() {
			var track_new = new track(ctx);
			track_new.chart = this;
			track_new.height = this.trackSizes;
			tracks.push(track_new);
			return track_new;
		}
		
		// loads genbank file
		this.loadGenbank = function(file) {
			genbank(file, this);
		}
		
		// loads array of gene objects
		this.loadGenes = function(genes) {
			for ( var i=0; i < genes.length; i++ )
				this.addGene( genes[i].position, genes[i].length, genes[i].strand );
		}
		
		// add's genes using the least number of tracks without overlapping genes
		this.addGene = function(position, length, strand) {
			
			var curr_track;
			var new_track = true;

			// try to add gene at lower tracks then move up
			for (var j=0; j < this.tracks.length; j++) {
				var prev_gene = this.tracks[j].genes[ this.tracks[j].genes.length - 1 ];

				// check if new track is needed
				if ( prev_gene != undefined && (position - 3/this.percentScale()) > (prev_gene.position + prev_gene.length) ) {
					new_track = false;
					curr_track = this.tracks[j];
					break;
				}
			}

			// add new track if needed
			if (new_track)
				curr_track = this.addTrack();
				
			// add gene
			var gene = curr_track.addGene( position, length, strand);	
			return gene;
		}
		
		
		// return region or slice of chart as new chart
		this.slice = function(from, to) {
			
			var sliced_genes = [];
			
			// iterate through tracks
			for ( var i=0; i < this.tracks.length; i++ ) {
				var s_genes = this.tracks[i].genes;
				for (var k=0; k < s_genes.length; k++ ) {
					var end = s_genes[k].position + s_genes[k].length
					var start = s_genes[k].position

					// determine if gene is in slice/region
					if ( start >= from && start <= to )
						sliced_genes.push( s_genes[k] )
					else if ( end > from && end < to )
						sliced_genes.push( s_genes[k] )				
					else if ( start < from && end > to )
						sliced_genes.push( s_genes[k] )				
					else if ( start > from && end < to)
						sliced_genes.push( s_genes[k] )				
				}				
				
			}
			
			var newChart = new Scribl(this.canvas, this.width);
			newChart.loadGenes(sliced_genes);
			return newChart;
		}
		
		this.delayed_draw = function(theChart) { 
			theChart.ctx.clearRect(0, 0, theChart.canvas.width, theChart.canvas.height);
			theChart.draw(); 
		}
		
		// function   : zooms chart in or out
		// startMin   = where the min (left) scale starts the zoom
		// stopMin    = where the min scale ends the zoom
		// startMax   = where the max (right) scale starts the zoom 
		// stopMax    = where the max scale ends the zoom
		// drawRate   = the delay (in milliseconds) between each draw (e.g. 1000 would be a 1s/frame draw rate)
		// smoothness = the number of pixels changed between frames ( lower = smoother but slower )
		this.zoom = function(startMin, startMax, stopMin, stopMax, drawRate, smoothness) {
			
			var newChart = undefined;
			var delay = 0;
			var pxlsToChange = smoothness;
			var currMax = startMax;
			var currMin = startMin;
		
			// loop till the zoom is done
			while(currMin != stopMin || currMax != stopMax) {
				
				// create new chart as a region of the original chart
				newChart = this.slice(currMin, currMax);
				
				// turn off auto scale stuff
				newChart.scale.off = true;
				newChart.scale.max_min.auto = false;
				newChart.scale.min = currMin;
				newChart.scale.max = currMax;
				newChart.scale.pretty = false;
				
				// set delay amount
				delay += drawRate;
				
				// schedule current chart to be drawn with some delay
				setTimeout(this.delayed_draw, delay, newChart );
				
				// determine number of nts to change min/max scales
				var maxNtsToChange = newChart.ntsPerPixel((currMax - stopMax)) * pxlsToChange;
				var minNtsToChange = newChart.ntsPerPixel((currMin - stopMin)) * pxlsToChange;
				
				// check if zoom is close enough stopMin
				if ( Math.abs(minNtsToChange) < .05 )
					currMin = stopMin;
				else
					currMin -= minNtsToChange;

				// check if zoom is close enough to stopMax
				if ( Math.abs(maxNtsToChange) < .05 )
					currMax = stopMax
				else
					currMax -= maxNtsToChange;	
				
			}
		
			// draw final zoomed chart with scale on
			// get final slice
			newChart = this.slice(stopMin, stopMax);
		
			// set scale
			newChart.scale.max = stopMax;
			newChart.scale.min = stopMin;
			
			// schedule final chart to be drawn at 1 millisecond after zoom completes
			setTimeout(this.delayed_draw, delay + 1, newChart);

		}
		

		
		// draws chart
		this.draw = function() {
			
						
			ctx.save();
			// make scale pretty by starting and ending the scale at major ticks and choosing best tick distances
			if (this.scale.pretty) {
		
				var numtimes = this.width/(ctx.measureText(this.scale.max).width+10);

				this.tick.major.size = Math.round(this.scale.max / numtimes / this.tick.major.size + .4) * this.tick.major.size;
				
				//if (this.scale.max <= 100)
				//	this.tick.major.size = 10;
				
				if (this.tick.major.size >= 1000) {
					var scaleMaxText = Math.round(this.scale.max/1000 + .4) + "k";
				 	numtimes = this.width/(ctx.measureText(scaleMaxText).width+10);
					this.tick.major.size = Math.round(this.scale.max / numtimes / 1000 + .4) * 1000;
					this.scale.units = "k";
				}		
				this.tick.minor.size = this.tick.major.size / 10 ;
				
				if (this.scale.max_min.auto) { 
					this.scale.min -= this.scale.min % this.tick.major.size;
					this.scale.max = Math.round(this.scale.max / this.tick.major.size + .4) * this.tick.major.size;
				}
			}
			
			// fix offsets so scale will not be cut off on left side
			// check if offset is turned off and then set it to static '0'
			if (this.scale.min.offset) 
				this.offset = ctx.measureText(this.getTickText(this.scale.min)).width/2;
			else
				this.offset = ctx.measureText("0").width/2;
				
			ctx.translate(this.offset, 0);
			
			// determine tick vertical sizes and vertical tick positions
			var tickStartPos = this.scale.font.size + this.scale.size ;
			var majorTickEndPos = this.scale.font.size + 2;
			var minorTickEndPos = this.scale.font.size + this.scale.size * 0.66;
			var halfTickEndPos = this.scale.font.size + this.scale.size * 0.33;
			
			// translate canvas so that the min can be non-zero and still draw at the starting left
			ctx.save();
			ctx.translate( -this.scale.min*this.percentScale() + 10, 0);
			
			// set scale defaults
			ctx.font = this.scale.font.size + "px arial";
			ctx.textBaseline = "top";
			var fillStyleRevert = ctx.fillStyle;
			ctx.fillStyle = this.scale.font.color;
			
			// draw scale
			if (!this.scale.off) {
				for (var i = this.scale.min; i <= this.scale.max; i++ ) {
				
					var curr_pos = i*this.percentScale();
				
					ctx.beginPath();
					if ( i % this.tick.major.size == 0) {
						// create text
						var tickText = this.getTickText(i);
						ctx.textAlign = "center";
						ctx.fillText( tickText , curr_pos, 0 );
					
						// create major tick
						ctx.moveTo( curr_pos, tickStartPos );
						ctx.lineTo( curr_pos, majorTickEndPos );
						ctx.strokeStyle = this.tick.major.color;
						ctx.stroke();

					} else if ( i % this.tick.minor.size == 0 ) {				
						ctx.moveTo( curr_pos, tickStartPos );
					
						// create half tick - tick between two major ticks
						if ( i % (this.tick.major.size/2) == 0 ) {
							ctx.strokeStyle = this.halfTickColor;						
							ctx.lineTo( curr_pos, halfTickEndPos );
						}
						// create minor tick
						else{
							ctx.strokeStyle = this.tick.minor.color;
							ctx.lineTo( curr_pos, minorTickEndPos );
						}
						ctx.stroke();
						//ctx.clearRect(0,0,900, 900);
					}
				}
			}
			
			// restore fillstyle
			ctx.fillStyle = fillStyleRevert;

			ctx.save();
			// draw tracks
			ctx.translate(0, this.scale.trackSize() + this.trackBuffer);
			for (var i=0; i<tracks.length; i++) {
				tracks[i].draw();
				ctx.translate(0, tracks[i].height + this.trackBuffer);
			}
			
			ctx.restore();	
			ctx.restore();	
			ctx.restore();	
		}

		this.getTickText = function(tickNumber) {
			var tickText = tickNumber;
			if ( this.scale.units == 'k' && tickNumber/1000 >= 1) {
				tickText = tickText / 1000 + 'k';
			}
			
			return tickText;
		}
		
	}


	function track(ctx) {
		// defaults
		this.height = undefined;
		this.genes = [];
		
		this.addGene = function( position, length, strand) {
			if (this.height == undefined)
				this.height = this.chart.trackSizes;
			
			// create gene
			var gene_new = new Gene(ctx, position, length, this.height, strand); 
			gene_new.track = this;
			this.genes.push(gene_new);
			
			// determine chart absolute_min and absolute_max
			if ( length + position > this.chart.scale.max || this.chart.scale.max == undefined )
				this.chart.scale.max = length + position;
			if ( position < this.chart.scale.min || this.chart.scale.min == undefined )
				this.chart.scale.min = position;				
				
			return gene_new;
		}
		
		// draw track
		this.draw = function() {
			for (var i=0; i< this.genes.length; i++) {
				var percentScale = this.genes[i].track.chart.percentScale();
				this.genes[i].draw(percentScale);
			}
		}
	}
	
	
	