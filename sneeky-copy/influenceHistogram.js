// Influence Type Histogram implementation with modified colors
class InfluenceHistogram {
    constructor(containerId) {
        this.container = d3.select(containerId);
        this.width = 800;
        this.height = 120;
        this.margin = { top: 40, right: 10, bottom: 20, left: 50 };
        this.innerWidth = this.width - this.margin.left - this.margin.right;
        this.innerHeight = this.height - this.margin.top - this.margin.bottom;
        
        this.shortLabels = {
            "InStyleOf": "In Style Of",
            "CoverOf": "Cover Of", 
            "DirectlySamples": "Directly Samples",
            "LyricalReferenceTo": "Lyrical Reference To",
            "InterpolatesFrom": "Interpolates From"
        };

        this.allInfluenceTypes = [
            "InStyleOf", "DirectlySamples", "CoverOf", 
            "LyricalReferenceTo", "InterpolatesFrom"
        ];

        // Modified colors - different from original
        this.influenceTypeColors = {
            "InStyleOf": "#e67e22",        // Orange instead of pink
            "CoverOf": "#8e44ad",          // Purple instead of salmon
            "DirectlySamples": "#27ae60",  // Green instead of teal
            "LyricalReferenceTo": "#f39c12", // Yellow instead of magenta
            "InterpolatesFrom": "#3498db"    // Blue instead of light pink
        };

        this.setupContainer();
    }

    setupContainer() {
        // Add title
        this.container.append("h3")
            .style("margin", "0 0 10px 0")
            .style("color", "#2c3e50")
            .text("Oceanus Folk Influence Types Over Time");

        // Create legend
        this.createLegend();

        // Create SVG
        this.svg = this.container.append("svg")
            .attr("width", this.width)
            .attr("height", this.height);
    }

    createLegend() {
        const legendContainer = this.container.append("div")
            .style("display", "flex")
            .style("justify-content", "center")
            .style("flex-wrap", "wrap")
            .style("padding", "8px 12px")
            .style("background-color", "white")
            .style("border-radius", "6px")
            .style("box-shadow", "0 1px 3px rgba(0,0,0,0.1)")
            .style("user-select", "none")
            .style("margin-bottom", "10px");

        this.allInfluenceTypes.forEach(type => {
            const legendItem = legendContainer.append("div")
                .style("display", "flex")
                .style("align-items", "center")
                .style("margin-right", "15px")
                .style("font-size", "10px")
                .style("cursor", "default");

            legendItem.append("div")
                .style("width", "10px")
                .style("height", "10px")
                .style("margin-right", "5px")
                .style("background-color", this.influenceTypeColors[type]);

            legendItem.append("span")
                .style("color", "#2c3e50")
                .text(this.shortLabels[type] || type);
        });
    }

    // Compute influence type counts by year - identical logic to original
    computeOceanusFolkInfluenceTypeCounts(nodes, links, selectedInfluenceTypes, yearRange) {
        const [minYear, maxYear] = yearRange;
        const nodeById = new Map(nodes.map(n => [n.id, n]));
        const result = {};

        links.forEach(link => {
            const edgeType = link.edgeType || link["Edge Type"];
            if (!selectedInfluenceTypes.has(edgeType)) return;

            const source = nodeById.get(link.source);
            const target = nodeById.get(link.target);
            if (!source || !target || target.genre !== "Oceanus Folk") return;

            const year = parseInt(target.release_date);
            if (isNaN(year) || year < minYear || year > maxYear) return;

            if (!result[year]) result[year] = {};
            if (!result[year][edgeType]) result[year][edgeType] = 0;

            result[year][edgeType] += 1;
        });

        return result;
    }

    render(nodes, links, selectedInfluenceTypes, yearRange) {
        // Clear previous visualization
        this.svg.selectAll("*").remove();

        const data = this.computeOceanusFolkInfluenceTypeCounts(
            nodes, links, selectedInfluenceTypes, yearRange
        );

        if (Object.keys(data).length === 0) {
            this.svg.append("text")
                .attr("x", this.width / 2)
                .attr("y", this.height / 2)
                .attr("text-anchor", "middle")
                .style("fill", "#7f8c8d")
                .text("No influence data available for selected criteria");
            return;
        }

        const years = Object.keys(data).map(d => +d).sort((a, b) => a - b);
        const types = this.allInfluenceTypes.filter(t => 
            Object.values(data).some(d => d[t])
        );

        // Prepare stacked data
        const stackData = years.map(year => {
            const entry = { year };
            types.forEach(type => {
                entry[type] = data[year]?.[type] || 0;
            });
            return entry;
        });

        const stack = d3.stack().keys(types);
        const series = stack(stackData);

        // Set up scales
        const y = d3.scaleBand()
            .domain(years)
            .range([0, this.innerHeight])
            .padding(0.2);

        const x = d3.scaleLinear()
            .domain([0, d3.max(stackData, d => d3.sum(types.map(t => d[t])))])
            .nice()
            .range([0, this.innerWidth]);

        const color = d3.scaleOrdinal()
            .domain(this.allInfluenceTypes)
            .range(this.allInfluenceTypes.map(type => this.influenceTypeColors[type]));

        const g = this.svg.append("g")
            .attr("transform", `translate(${this.margin.left},${this.margin.top})`);

        // Create tooltip
        const tooltip = d3.select("body").select(".histogram-tooltip").empty() ?
            d3.select("body").append("div").attr("class", "histogram-tooltip") :
            d3.select("body").select(".histogram-tooltip");
        
        tooltip
            .style("position", "absolute")
            .style("background", "white")
            .style("border", "1px solid #ccc")
            .style("padding", "8px")
            .style("font-size", "12px")
            .style("border-radius", "4px")
            .style("box-shadow", "0px 2px 6px rgba(0,0,0,0.2)")
            .style("pointer-events", "none")
            .style("opacity", 0);

        // Draw stacked bars
        g.selectAll("g.layer")
            .data(series)
            .enter()
            .append("g")
            .attr("class", "layer")
            .attr("fill", d => color(d.key))
            .selectAll("rect")
            .data(d => d)
            .enter()
            .append("rect")
            .attr("y", d => y(d.data.year))
            .attr("x", d => x(d[0]))
            .attr("width", d => x(d[1]) - x(d[0]))
            .attr("height", y.bandwidth())
            .style("stroke", "#2c3e50")
            .style("stroke-width", 0.5)
            .on("mouseover", (event, d) => {
                const yearData = d.data;
                const total = Object.keys(yearData)
                    .filter(k => types.includes(k))
                    .reduce((sum, key) => sum + yearData[key], 0);

                const details = types
                    .filter(t => yearData[t] > 0)
                    .map(t => `${this.shortLabels[t] || t}: ${yearData[t]}`)
                    .join("<br>");

                tooltip.html(`
                    <strong>Year:</strong> ${yearData.year}<br>
                    <strong>Total:</strong> ${total}<br>
                    ${details}
                `)
                .style("left", (event.pageX + 10) + "px")
                .style("top", (event.pageY - 28) + "px")
                .style("opacity", 0.95);
            })
            .on("mouseout", () => {
                tooltip.style("opacity", 0);
            });

        // Add Y axis (years)
        g.append("g")
            .call(d3.axisLeft(y).tickValues(years))
            .selectAll("text")
            .style("font-size", "10px")
            .style("fill", "#2c3e50");

        // Add X axis (counts)
        g.append("g")
            .attr("transform", `translate(0,${this.innerHeight})`)
            .call(d3.axisBottom(x).ticks(3))
            .selectAll("text")
            .style("font-size", "10px")
            .style("fill", "#2c3e50");

        // Add axis labels
        g.append("text")
            .attr("transform", "rotate(-90)")
            .attr("y", 0 - this.margin.left + 15)
            .attr("x", 0 - (this.innerHeight / 2))
            .style("text-anchor", "middle")
            .style("fill", "#2c3e50")
            .style("font-weight", "bold")
            .style("font-size", "12px")
            .text("Year");

        g.append("text")
            .attr("transform", `translate(${this.innerWidth / 2}, ${this.innerHeight + this.margin.bottom - 5})`)
            .style("text-anchor", "middle")
            .style("fill", "#2c3e50")
            .style("font-weight", "bold")
            .style("font-size", "12px")
            .text("Number of Influences");
    }
}