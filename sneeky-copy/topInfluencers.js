// Top Influencers Temporal Plot implementation with modified colors
class TopInfluencers {
    constructor(containerId) {
        this.container = d3.select(containerId);
        this.width = 800;
        this.height = 600;
        this.margin = { top: 40, right: 30, bottom: 40, left: 100 };
        this.innerWidth = this.width - this.margin.left - this.margin.right;
        this.innerHeight = this.height - this.margin.top - this.margin.bottom;
        this.events = [];
        this.topEvents = [];
        this.persons = [];
        
        this.setupSVG();
        this.setupEdgeDescriptions();
    }

    setupSVG() {
        this.svg = this.container.append("svg")
            .attr("width", this.width)
            .attr("height", this.height);
        
        this.g = this.svg.append("g")
            .attr("transform", `translate(${this.margin.left},${this.margin.top})`);
    }

    setupEdgeDescriptions() {
        this.edgeDescriptions = {
            PerformerOf: (s, t) => `${s} performed ${t}`,
            ComposerOf: (s, t) => `${s} composed ${t}`,
            ProducerOf: (s, t) => `${s} produced ${t}`,
            LyricistOf: (s, t) => `${s} wrote lyrics for ${t}`,
            RecordedBy: (s, t) => `${t} was recorded by ${s}`,
            DistributedBy: (s, t) => `${t} aided in distribution of ${s}`,
            InStyleOf: (s, t) => `${s} was performed (partly) in the style of ${t}`,
            InterpolatesFrom: (s, t) => `${s} interpolates a melody from ${t}`,
            CoverOf: (s, t) => `${s} is a cover of ${t}`,
            LyricalReferenceTo: (s, t) => `${s} makes a lyrical reference to ${t}`,
            DirectlySamples: (s, t) => `${s} directly samples ${t}`,
            MemberOf: (s, t) => `${s} was/is a member of ${t}`,
        };
    }

    // Collect events per influence path - identical logic to original
    collectInfluenceEvents(nodes, links) {
        const nodeById = new Map(nodes.map(n => [n.id, n]));
        
        // Build adjacency list
        const adjList = new Map();
        nodes.forEach(n => adjList.set(n.id, []));
        links.forEach(e => {
            adjList.get(e.source).push({ neighbor: e.target, edgeType: e["Edge Type"] });
            adjList.get(e.target).push({ neighbor: e.source, edgeType: e["Edge Type"] });
        });

        const sailorNode = nodes.find(n => n.name === "Sailor Shift");
        if (!sailorNode) return [];

        const sailorId = sailorNode.id;
        const visited = new Set();
        const collected = [];
        const seenPaths = new Set();
        const queue = [
            { id: sailorId, path: [sailorNode.name], pathIds: [sailorId], depth: 0 }
        ];
        const maxDepth = 3;

        while (queue.length) {
            const { id: currId, path, pathIds, depth } = queue.shift();
            if (visited.has(currId)) continue;
            visited.add(currId);
            const currName = nodeById.get(currId).name;

            for (const { neighbor, edgeType } of adjList.get(currId)) {
                if (depth >= maxDepth) continue;
                const neighNode = nodeById.get(neighbor);
                if (!neighNode) continue;

                const isForward = links.find(l =>
                    (l.source === currId && l.target === neighbor) ||
                    (l.source === neighbor && l.target === currId)
                )?.source === currId;

                const from = isForward ? currName : neighNode.name;
                const to = isForward ? neighNode.name : currName;

                const desc = this.edgeDescriptions[edgeType]
                    ? this.edgeDescriptions[edgeType](from, to)
                    : `${from} ${edgeType} ${to}`;
                const newPath = [...path, desc];
                const newPathIds = [...pathIds, neighbor];

                // If it's a song/album with release date, record event for each contributor
                if ((neighNode["Node Type"].includes("Song") ||
                     neighNode["Node Type"].includes("Album")) &&
                    neighNode.release_date) {
                    
                    for (const { neighbor: contributorId, edgeType: contributionType } of adjList.get(neighNode.id)) {
                        const contributor = nodeById.get(contributorId);
                        if (contributor["Node Type"] === "Person" && contributor.id !== sailorId) {
                            const releaseDesc = `${neighNode.name} was released in ${neighNode.release_date}`;
                            const contributionStep = this.edgeDescriptions[contributionType]
                                ? this.edgeDescriptions[contributionType](contributor.name, neighNode.name)
                                : `${contributor.name} ${contributionType} ${neighNode.name}`;

                            const fullPath = [...newPath, releaseDesc, contributionStep];
                            const pathKey = `${contributor.id}::${fullPath.join(" > ")}`;
                            if (!seenPaths.has(pathKey)) {
                                collected.push({
                                    personId: contributor.id,
                                    personName: contributor.name,
                                    release_date: +neighNode.release_date,
                                    collectPath: fullPath,
                                });
                                seenPaths.add(pathKey);
                            }
                        }
                    }
                } else {
                    queue.push({
                        id: neighbor,
                        path: newPath,
                        pathIds: newPathIds,
                        depth: depth + 1,
                    });
                }
            }
        }

        return collected;
    }

    render(nodes, links) {
        // Clear previous content
        this.container.selectAll("*").remove();
        this.setupSVG();

        // Add title
        this.container.insert("h2", "svg")
            .text("Top Influencers")
            .style("margin", "0 0 10px 0")
            .style("color", "#2c3e50");

        // Collect events
        this.events = this.collectInfluenceEvents(nodes, links);
        if (this.events.length === 0) {
            this.container.append("div")
                .style("text-align", "center")
                .style("padding", "20px")
                .style("color", "#7f8c8d")
                .text("No influence events found");
            return;
        }

        // Get top 30 persons and their events (exclude Sailor Shift)
        const sailorId = nodes.find(n => n.name === "Sailor Shift")?.id;
        const counts = d3.rollup(this.events, v => v.length, d => d.personId);
        const topPersons = Array.from(counts)
            .filter(([id]) => id !== sailorId)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 30)
            .map(([id]) => id);

        this.topEvents = this.events.filter(e => topPersons.includes(e.personId));
        const nodeById = new Map(nodes.map(n => [n.id, n]));
        this.persons = topPersons.map(id => nodeById.get(id).name);

        this.renderScatterPlot();
    }

    renderScatterPlot() {
        if (!this.topEvents.length) return;

        // Set up scales
        const x = d3.scaleLinear()
            .domain(d3.extent(this.topEvents, d => d.release_date))
            .nice()
            .range([0, this.innerWidth]);

        const y = d3.scalePoint()
            .domain(this.persons)
            .range([this.innerHeight, 0])
            .padding(1);

        // Modified color scheme - using different colors than original
        const color = d3.scaleOrdinal()
            .domain(this.persons)
            .range([
                "#e74c3c", "#3498db", "#f39c12", "#2ecc71", "#9b59b6", 
                "#e67e22", "#1abc9c", "#34495e", "#f1c40f", "#e91e63",
                "#8e44ad", "#27ae60", "#16a085", "#2980b9", "#d35400",
                "#c0392b", "#7f8c8d", "#95a5a6", "#f39c12", "#e74c3c",
                "#3498db", "#2ecc71", "#9b59b6", "#e67e22", "#1abc9c",
                "#34495e", "#f1c40f", "#e91e63", "#8e44ad", "#27ae60"
            ]);

        // Add gridlines
        this.g.append("g")
            .attr("class", "grid x-grid")
            .attr("transform", `translate(0,${this.innerHeight})`)
            .attr("opacity", 0.3)
            .style("stroke", "#95a5a6")
            .style("stroke-dasharray", "2,2")
            .call(d3.axisBottom(x).tickSize(-this.innerHeight).tickFormat(""));

        this.g.append("g")
            .attr("class", "grid y-grid")
            .attr("opacity", 0.3)
            .style("stroke", "#95a5a6")
            .style("stroke-dasharray", "2,2")
            .call(d3.axisLeft(y).tickSize(-this.innerWidth).tickFormat(""));

        // Add axes
        this.g.append("g")
            .attr("transform", `translate(0,${this.innerHeight})`)
            .call(d3.axisBottom(x).tickFormat(d3.format("d")))
            .selectAll("text")
            .style("fill", "#2c3e50");

        this.g.append("g")
            .call(d3.axisLeft(y))
            .selectAll("text")
            .style("fill", "#2c3e50")
            .style("font-size", "10px");

        // Add axis labels
        this.g.append("text")
            .attr("transform", `translate(${this.innerWidth / 2}, ${this.innerHeight + 35})`)
            .style("text-anchor", "middle")
            .style("fill", "#2c3e50")
            .style("font-weight", "bold")
            .text("Release Year");

        this.g.append("text")
            .attr("transform", "rotate(-90)")
            .attr("y", 0 - this.margin.left + 15)
            .attr("x", 0 - (this.innerHeight / 2))
            .style("text-anchor", "middle")
            .style("fill", "#2c3e50")
            .style("font-weight", "bold")
            .text("Artist");

        // Add scatter points
        this.g.selectAll("circle")
            .data(this.topEvents)
            .enter()
            .append("circle")
            .attr("cx", d => x(d.release_date))
            .attr("cy", d => y(d.personName))
            .attr("r", 5)
            .style("fill", d => color(d.personName))
            .style("stroke", "#2c3e50")
            .style("stroke-width", 1.5)
            .style("cursor", "pointer")
            .on("mouseover", (event, d) => {
                // Highlight point
                d3.select(event.target)
                    .transition()
                    .duration(150)
                    .attr("r", 7)
                    .style("stroke-width", 2);

                // Show tooltip
                d3.select("#tooltip")
                    .style("visibility", "visible")
                    .html(`
                        <strong>${d.personName}</strong><br>
                        <strong>Year:</strong> ${d.release_date}<br>
                        <strong>Path:</strong><br>
                        ${d.collectPath.slice(0, 3).join(" → ")}<br>
                        ${d.collectPath.length > 3 ? "..." : ""}
                    `)
                    .style("top", (event.pageY + 8) + "px")
                    .style("left", (event.pageX + 8) + "px");
            })
            .on("mouseout", (event) => {
                // Reset point
                d3.select(event.target)
                    .transition()
                    .duration(150)
                    .attr("r", 5)
                    .style("stroke-width", 1.5);

                // Hide tooltip
                d3.select("#tooltip").style("visibility", "hidden");
            })
            .on("click", (event, d) => {
                if (this.onNodeClickCallback) {
                    const fullNode = {
                        id: d.personId,
                        name: d.personName,
                        collectPath: d.collectPath,
                        connectionPath: d.collectPath,
                    };
                    this.onNodeClickCallback(fullNode);
                }
                
                // Show detailed path in a pinned tooltip
                const pinnedTooltip = d3.select("body")
                    .append("div")
                    .attr("class", "tooltip pinned-tooltip")
                    .style("position", "absolute")
                    .style("top", `${event.pageY + 8}px`)
                    .style("left", `${event.pageX + 8}px`)
                    .style("background", "white")
                    .style("border", "1px solid #ccc")
                    .style("padding", "12px")
                    .style("border-radius", "4px")
                    .style("box-shadow", "0px 4px 8px rgba(0,0,0,0.2)")
                    .style("max-width", "400px")
                    .style("z-index", "1000")
                    .html(`
                        <div style="display: flex; align-items: flex-start; justify-content: space-between; gap: 8px;">
                            <div>
                                <strong>${d.personName}</strong> (${d.release_date})<br><br>
                                <strong>Influence Path:</strong><br>
                                ${d.collectPath.join("<br>→ ")}
                            </div>
                            <button class="close-tooltip" style="background: none; border: none; font-size: 16px; cursor: pointer; padding: 0; margin: 0; color: #e74c3c;">✖</button>
                        </div>
                    `);

                pinnedTooltip.select(".close-tooltip").on("click", () => {
                    pinnedTooltip.remove();
                });
            });

        // Add legend for top artists
        this.addLegend(color);
    }

    addLegend(colorScale) {
        const legendContainer = this.container.append("div")
            .style("margin-top", "20px")
            .style("background", "#ecf0f1")
            .style("padding", "10px")
            .style("border-radius", "4px")
            .style("max-height", "150px")
            .style("overflow-y", "auto");

        legendContainer.append("div")
            .style("font-weight", "bold")
            .style("margin-bottom", "10px")
            .style("color", "#2c3e50")
            .text("Top Influencing Artists (click points for details)");

        const legendItems = legendContainer.append("div")
            .style("display", "flex")
            .style("flex-wrap", "wrap")
            .style("gap", "8px");

        // Show top 10 in legend
        const topArtists = this.persons.slice(0, 10);
        
        topArtists.forEach(artist => {
            const legendItem = legendItems.append("div")
                .style("display", "flex")
                .style("align-items", "center")
                .style("gap", "4px")
                .style("font-size", "11px");

            legendItem.append("div")
                .style("width", "12px")
                .style("height", "12px")
                .style("border-radius", "50%")
                .style("background-color", colorScale(artist))
                .style("border", "1px solid #2c3e50");

            legendItem.append("span")
                .style("color", "#2c3e50")
                .text(artist);
        });

        if (this.persons.length > 10) {
            legendContainer.append("div")
                .style("font-size", "10px")
                .style("color", "#7f8c8d")
                .style("margin-top", "5px")
                .text(`... and ${this.persons.length - 10} more artists`);
        }
    }

    setNodeClickCallback(callback) {
        this.onNodeClickCallback = callback;
    }
}