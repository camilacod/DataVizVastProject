// Genre Influence Matrix implementation with modified colors
class GenreMatrix {
    constructor(containerId) {
        this.container = d3.select(containerId);
        this.selectedGenre = null;
        this.cellSize = 15;
        this.labelSize = 70;
    }

    // Compute genre influence matrix - identical logic to original
    computeGenreInfluenceMatrix(nodes, links, yearRange, mode = 'outgoing') {
        const [minYear, maxYear] = yearRange;
        const nodeById = new Map(nodes.map(n => [n.id, n]));
        const genreSet = new Set(nodes.map(n => n.genre).filter(Boolean));
        const genres = Array.from(genreSet);

        const matrix = {};
        genres.forEach(src => {
            matrix[src] = {};
            genres.forEach(tgt => {
                matrix[src][tgt] = 0;
            });
        });

        links.forEach(link => {
            const source = nodeById.get(link.source);
            const target = nodeById.get(link.target);
            if (!source || !target) return;

            const year = parseInt(target.release_date);
            if (isNaN(year) || year < minYear || year > maxYear) return;

            const sourceGenre = source.genre;
            const targetGenre = target.genre;

            if (!sourceGenre || !targetGenre) return;

            const influencerGenre = targetGenre;
            const influencedGenre = sourceGenre;

            if (mode === 'outgoing') {
                matrix[influencerGenre][influencedGenre] += 1;
            } else if (mode === 'incoming') {
                matrix[influencedGenre][influencerGenre] += 1;
            }
        });

        return { matrix, genres };
    }

    // Modified color scheme - blue to orange instead of white to red
    getColor(value, maxValue) {
        if (value === 0) return "#f8f9fa"; // Very light gray instead of white
        
        const threshold = 5;
        let intensity;
        
        if (value <= threshold) {
            intensity = (value / threshold) * 0.5;
        } else {
            const logVal = Math.log(value - threshold + 1);
            const logMax = Math.log(maxValue - threshold + 1);
            intensity = 0.5 + (logVal / logMax) * 0.5;
        }
        
        // Blue to orange color interpolation instead of white to red
        const startColor = d3.rgb(52, 152, 219);  // Blue
        const endColor = d3.rgb(230, 126, 34);    // Orange
        
        const r = Math.round(startColor.r + (endColor.r - startColor.r) * intensity);
        const g = Math.round(startColor.g + (endColor.g - startColor.g) * intensity);
        const b = Math.round(startColor.b + (endColor.b - startColor.b) * intensity);
        
        return `rgb(${r}, ${g}, ${b})`;
    }

    render(nodes, links, yearRange, mode) {
        // Clear previous content
        this.container.selectAll("*").remove();

        const { matrix, genres } = this.computeGenreInfluenceMatrix(nodes, links, yearRange, mode);
        
        // Sort genres and get Sailor Shift genres for highlighting
        genres.sort((a, b) => a.localeCompare(b));
        const sailorShiftGenres = window.dataLoader.getSailorShiftGenres();

        // Get values for normalization
        const values = genres.flatMap(row => 
            genres.map(col => matrix[row][col])
        ).filter(v => v > 0);
        
        if (values.length === 0) {
            this.container.append("div")
                .style("text-align", "center")
                .style("padding", "20px")
                .text("No data available for the selected year range");
            return;
        }

        const minValue = Math.min(...values);
        const maxValue = Math.max(...values);

        // Create main container
        const mainDiv = this.container.append("div")
            .style("overflow", "visible")
            .style("width", "100%")
            .style("height", "auto");

        // Top row with column labels
        const topRow = mainDiv.append("div")
            .style("display", "flex")
            .style("margin-left", "30px");

        // Empty top-left cell
        topRow.append("div")
            .style("width", this.labelSize + "px")
            .style("height", this.labelSize + "px");

        // Column labels container
        const colLabelsDiv = topRow.append("div")
            .style("display", "flex");

        // Column labels (vertical, rotated)
        colLabelsDiv.selectAll(".col-label")
            .data(genres)
            .enter()
            .append("div")
            .attr("class", "col-label")
            .style("width", this.cellSize + "px")
            .style("height", this.labelSize + "px")
            .style("writing-mode", "vertical-rl")
            .style("text-align", "left")
            .style("font-size", "8px")
            .style("transform", "rotate(180deg)")
            .style("padding", "1px")
            .style("margin-bottom", "15px")
            .style("font-weight", d => sailorShiftGenres.has(d) ? "bold" : "normal")
            .style("font-style", d => sailorShiftGenres.has(d) ? "italic" : "normal")
            .style("cursor", "pointer")
            .style("opacity", d => this.selectedGenre && this.selectedGenre !== d ? 0.2 : 1)
            .style("transition", "opacity 0.2s")
            .style("color", "#2c3e50") // Dark blue-gray text
            .attr("title", d => d)
            .text(d => d)
            .on("click", (event, d) => {
                this.selectedGenre = this.selectedGenre === d ? null : d;
                this.render(nodes, links, yearRange, mode);
            });

        // Matrix rows
        const matrixDiv = mainDiv.append("div")
            .style("display", "flex");

        const rowsContainer = matrixDiv.append("div")
            .style("display", "flex")
            .style("flex-direction", "column")
            .style("margin-right", "20px");

        // Create rows
        const rows = rowsContainer.selectAll(".matrix-row")
            .data(genres)
            .enter()
            .append("div")
            .attr("class", "matrix-row")
            .style("display", "flex");

        // Row labels
        rows.append("div")
            .style("width", this.labelSize + "px")
            .style("height", this.cellSize + "px")
            .style("font-size", "8px")
            .style("white-space", "nowrap")
            .style("overflow", "visible")
            .style("text-overflow", "ellipsis")
            .style("padding", "1px")
            .style("margin-right", "30px")
            .style("font-weight", d => sailorShiftGenres.has(d) ? "bold" : "normal")
            .style("font-style", d => sailorShiftGenres.has(d) ? "italic" : "normal")
            .style("cursor", "pointer")
            .style("opacity", d => this.selectedGenre && this.selectedGenre !== d ? 0.2 : 1)
            .style("transition", "opacity 0.2s")
            .style("color", "#2c3e50") // Dark blue-gray text
            .attr("title", d => d)
            .text(d => d)
            .on("click", (event, d) => {
                this.selectedGenre = this.selectedGenre === d ? null : d;
                this.render(nodes, links, yearRange, mode);
            });

        // Data cells container for each row
        const cellsContainer = rows.append("div")
            .style("display", "flex");

        // Data cells
        cellsContainer.selectAll(".matrix-cell")
            .data(rowGenre => genres.map(colGenre => ({
                row: rowGenre,
                col: colGenre,
                value: matrix[rowGenre][colGenre]
            })))
            .enter()
            .append("div")
            .attr("class", "matrix-cell")
            .style("width", this.cellSize + "px")
            .style("height", this.cellSize + "px")
            .style("background-color", d => this.getColor(d.value, maxValue))
            .style("border", "1px solid #34495e") // Dark blue-gray border
            .style("cursor", d => d.value > 0 ? "pointer" : "default")
            .style("opacity", d => {
                const faded = this.selectedGenre && 
                            this.selectedGenre !== d.row && 
                            this.selectedGenre !== d.col;
                return faded ? 0.1 : 1;
            })
            .style("transition", "opacity 0.2s")
            .attr("title", d => `${d.col} has taken ${d.value} influences from ${d.row}`)
            .on("mouseover", function(event, d) {
                if (d.value > 0) {
                    d3.select("#tooltip")
                        .style("visibility", "visible")
                        .text(`${d.col} ← ${d.value} influences ← ${d.row}`)
                        .style("top", (event.pageY + 8) + "px")
                        .style("left", (event.pageX + 8) + "px");
                }
            })
            .on("mouseout", function() {
                d3.select("#tooltip").style("visibility", "hidden");
            });

        // Add legend
        this.addLegend(mainDiv, minValue, maxValue);
    }

    addLegend(container, minValue, maxValue) {
        const legendDiv = container.append("div")
            .style("margin-top", "20px")
            .style("padding", "10px")
            .style("background", "#ecf0f1")
            .style("border-radius", "4px");

        legendDiv.append("div")
            .style("font-weight", "bold")
            .style("margin-bottom", "10px")
            .style("color", "#2c3e50")
            .text("Influence Intensity");

        const legendScale = legendDiv.append("div")
            .style("display", "flex")
            .style("align-items", "center")
            .style("gap", "10px");

        // Create gradient bar
        const gradientSteps = 20;
        const stepWidth = 10;
        
        const gradientBar = legendScale.append("div")
            .style("display", "flex");

        for (let i = 0; i <= gradientSteps; i++) {
            const value = minValue + (maxValue - minValue) * (i / gradientSteps);
            gradientBar.append("div")
                .style("width", stepWidth + "px")
                .style("height", "20px")
                .style("background-color", this.getColor(value, maxValue))
                .style("border", "1px solid #34495e");
        }

        // Add labels
        legendScale.append("span")
            .style("font-size", "12px")
            .style("color", "#2c3e50")
            .text(`${minValue} - ${maxValue} influences`);
    }
}