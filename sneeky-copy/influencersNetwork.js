// Notable Artist Network implementation with modified colors
class InfluencersNetwork {
    constructor(containerId) {
        this.container = d3.select(containerId);
        this.width = 700;
        this.height = 300;
        this.selectedArtistIds = [];
        this.focusedNodeId = null;
        this.showOceanusFolk = true;
        this.minNotables = 0;
        this.selectedInfluenceTypes = new Set([
            "InStyleOf", "CoverOf", "DirectlySamples", 
            "LyricalReferenceTo", "InterpolatesFrom"
        ]);
        
        this.contributorEdgeTypes = new Set([
            "PerformerOf", "ComposerOf", "ProducerOf", "LyricistOf"
        ]);

        this.setupVisualization();
    }

    setupVisualization() {
        // Create container div
        const mainDiv = this.container.append("div")
            .style("display", "flex")
            .style("align-items", "flex-start")
            .style("gap", "20px");

        // Artist selector container
        this.selectorDiv = mainDiv.append("div")
            .style("max-width", "150px")
            .style("max-height", "200px")
            .style("overflow-y", "auto");

        // Main visualization container
        const vizContainer = mainDiv.append("div");

        // Legend
        this.legendDiv = vizContainer.append("div")
            .attr("class", "legend")
            .style("display", "flex")
            .style("gap", "10px")
            .style("font-size", "10px")
            .style("margin-bottom", "10px")
            .style("flex-wrap", "wrap")
            .style("background", "white")
            .style("padding", "7px")
            .style("border-radius", "5px")
            .style("max-width", "680px");

        // SVG for the network
        this.svg = vizContainer.append("svg")
            .attr("width", this.width)
            .attr("height", this.height)
            .style("border", "1px solid #ddd");

        // Controls container
        const controlsDiv = mainDiv.append("div")
            .style("margin-left", "-145px")
            .style("margin-top", "50px")
            .style("background", "white")
            .style("padding", "5px")
            .style("border-radius", "4px")
            .style("z-index", "9999")
            .style("position", "relative");

        this.oceanusFolkCheckbox = controlsDiv.append("label")
            .style("font-size", "10px")
            .style("cursor", "pointer");
        
        this.oceanusFolkCheckbox.append("input")
            .attr("type", "checkbox")
            .property("checked", true)
            .style("cursor", "pointer")
            .on("change", (event) => {
                this.showOceanusFolk = event.target.checked;
                this.render();
            });
        
        this.oceanusFolkCheckbox.append("text")
            .text(" Show Oceanus Folk");

        this.setupLegend();
    }

    // Modified colors for genre encoding
    getGenreColor(genre) {
        if (!genre) return "#7f8c8d"; // Gray
        const g = genre.toLowerCase();
        if (genre === "Oceanus Folk") return "#e74c3c"; // Red instead of original red
        if (g.includes("rock")) return "#9b59b6"; // Purple instead of blue
        if (g.includes("folk")) return "#f39c12"; // Orange instead of green
        if (g.includes("metal")) return "#3498db"; // Blue instead of purple
        if (g.includes("pop")) return "#2ecc71"; // Green instead of orange
        return "#34495e"; // Dark blue-gray instead of black
    }

    // Modified colors for influence types
    getInfluenceTypeColors() {
        return {
            InStyleOf: "#e67e22",      // Orange instead of pink
            CoverOf: "#8e44ad",        // Purple instead of salmon  
            DirectlySamples: "#27ae60", // Green instead of teal
            LyricalReferenceTo: "#f39c12", // Yellow instead of purple
            InterpolatesFrom: "#3498db"    // Blue instead of pink
        };
    }

    setupLegend() {
        const influenceTypeColors = this.getInfluenceTypeColors();
        
        const legendItems = [
            { text: "Artist", shape: "circle" },
            { text: "Group", shape: "star" },
            { text: "Album", shape: "square" },
            { text: "Song", shape: "triangle" }
        ];

        // Add shape legends
        legendItems.forEach(item => {
            const legendItem = this.legendDiv.append("div")
                .style("display", "flex")
                .style("align-items", "center")
                .style("gap", "5px");

            const box = legendItem.append("div")
                .style("width", "12px")
                .style("height", "12px")
                .style("background-color", "#7f8c8d")
                .style("display", "inline-block");

            if (item.shape === "circle") {
                box.style("border-radius", "50%");
            } else if (item.shape === "star") {
                box.style("clip-path", "polygon(50% 0%, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%)");
            } else if (item.shape === "triangle") {
                box.style("clip-path", "polygon(50% 0%, 0% 100%, 100% 100%)");
            }

            legendItem.append("span").text(item.text);
        });

        // Add influence type legends
        Object.entries(influenceTypeColors).forEach(([type, color]) => {
            const legendItem = this.legendDiv.append("div")
                .style("display", "flex")
                .style("align-items", "center")
                .style("gap", "5px");

            legendItem.append("div")
                .style("width", "12px")
                .style("height", "12px")
                .style("background-color", color)
                .style("display", "inline-block");

            legendItem.append("span").text(type);
        });
    }

    render(nodes, links, yearRange) {
        if (!nodes || !links) return;

        const [minYear, maxYear] = yearRange;
        const nodeById = new Map(nodes.map(n => [n.id, n]));
        
        // Calculate derived data
        const { 
            oceanusFolkSongs, 
            influenceLinks, 
            influenceTargets, 
            songPerformers, 
            performerNotableCounts 
        } = this.calculateDerivedData(nodes, links, nodeById, minYear, maxYear);

        // Filter nodes and links
        const { graphNodes, graphLinks } = this.filterGraphData(
            nodes, links, nodeById, oceanusFolkSongs, influenceTargets, 
            songPerformers, performerNotableCounts, influenceLinks
        );

        // Update artist selector
        this.updateArtistSelector(graphNodes);

        // Create force simulation
        this.createForceSimulation(graphNodes, graphLinks);
    }

    calculateDerivedData(nodes, links, nodeById, minYear, maxYear) {
        // Get Oceanus Folk songs in year range
        const oceanusFolkSongs = new Set(
            nodes.filter(n =>
                (n.genre === "Oceanus Folk") &&
                (this.getNodeType(n) === "Song" || this.getNodeType(n) === "Album") &&
                !isNaN(+n.release_date) &&
                +n.release_date >= minYear &&
                +n.release_date <= maxYear
            ).map(n => n.id)
        );

        // Get influence links to Oceanus Folk songs
        const influenceLinks = links.filter(link => {
            const edgeType = this.getEdgeType(link);
            const sourceNode = nodeById.get(link.source);
            const targetNode = nodeById.get(link.target);
            if (!sourceNode || !targetNode) return false;
            return (
                this.selectedInfluenceTypes.has(edgeType) &&
                oceanusFolkSongs.has(link.target)
            );
        });

        const influenceTargets = new Set(influenceLinks.map(link => link.source));

        // Map songs to their performers
        const songPerformers = new Map();
        links.forEach(link => {
            if (this.contributorEdgeTypes.has(this.getEdgeType(link))) {
                const songId = link.target;
                const performerId = link.source;
                if (!songPerformers.has(songId)) songPerformers.set(songId, new Set());
                songPerformers.get(songId).add(performerId);
            }
        });

        // Count notable works per performer
        const performerNotableCounts = new Map();
        links.forEach(link => {
            if (!this.contributorEdgeTypes.has(this.getEdgeType(link))) return;
            const performer = link.source;
            const work = nodeById.get(link.target);
            if (!work || !work.notable) return;
            performerNotableCounts.set(performer, (performerNotableCounts.get(performer) || 0) + 1);
        });

        return { 
            oceanusFolkSongs, 
            influenceLinks, 
            influenceTargets, 
            songPerformers, 
            performerNotableCounts 
        };
    }

    filterGraphData(nodes, links, nodeById, oceanusFolkSongs, influenceTargets, 
                   songPerformers, performerNotableCounts, influenceLinks) {
        // Filter performer links
        const preliminaryPerformerLinks = links.filter(link => {
            if (!this.contributorEdgeTypes.has(this.getEdgeType(link))) return false;
            const songNode = nodeById.get(link.target);
            if (!songNode) return false;
            if (!this.showOceanusFolk && songNode.genre === "Oceanus Folk") return false;
            if (songNode.genre !== "Oceanus Folk") {
                const performerNotables = performerNotableCounts.get(link.source) || 0;
                if (performerNotables < this.minNotables) return false;
            }
            const sourceNode = nodeById.get(link.source);
            if (this.getNodeType(sourceNode) === "RecordLabel") return false;
            return true;
        });

        const preliminaryPerformerIds = new Set(preliminaryPerformerLinks.map(link => link.source));

        // Filter songs
        const baseSongs = new Set([...oceanusFolkSongs, ...influenceTargets]);
        const filteredSongsFinal = new Set();
        baseSongs.forEach(songId => {
            const performers = songPerformers.get(songId);
            if (!performers) {
                filteredSongsFinal.add(songId);
            } else {
                const hasVisiblePerformer = [...performers].some(p => preliminaryPerformerIds.has(p));
                if (hasVisiblePerformer) filteredSongsFinal.add(songId);
            }
        });

        const filteredPerformerLinks = preliminaryPerformerLinks.filter(link => 
            filteredSongsFinal.has(link.target)
        );

        const performerIds = new Set(filteredPerformerLinks.map(link => link.source));
        const visibleNodeIds = new Set([...filteredSongsFinal, ...performerIds]);

        // Create graph nodes
        const graphNodes = Array.from(visibleNodeIds).map(id => {
            const n = nodeById.get(id);
            if (!n || (!this.showOceanusFolk && n.genre === "Oceanus Folk")) return null;
            if (this.getNodeType(n) === "RecordLabel") return null;
            
            if (performerIds.has(id)) {
                const performed = filteredPerformerLinks.find(l => l.source === id);
                const genreFromSong = performed ? nodeById.get(performed.target)?.genre : null;
                return {
                    id,
                    name: n.name || id,
                    group: this.getNodeType(n) || "Performer",
                    genre: genreFromSong || n.genre
                };
            }
            return {
                id,
                name: n.name || id,
                group: this.getNodeType(n),
                genre: n.genre
            };
        }).filter(Boolean);

        // Create graph links
        const graphLinks = [...influenceLinks, ...filteredPerformerLinks]
            .filter(link =>
                graphNodes.find(n => n.id === link.source) &&
                graphNodes.find(n => n.id === link.target)
            ).map(link => ({
                source: link.source,
                target: link.target,
                edgeType: this.getEdgeType(link)
            }));

        return { graphNodes, graphLinks };
    }

    updateArtistSelector(graphNodes) {
        const performerNodes = graphNodes
            .filter(n => n.group === "Person" || n.group === "Performer")
            .sort((a, b) => a.name.localeCompare(b.name));

        // Clear existing selector
        this.selectorDiv.selectAll("*").remove();

        if (performerNodes.length === 0) return;

        const selector = this.selectorDiv.append("select")
            .attr("multiple", true)
            .style("width", "100%")
            .style("height", "150px")
            .on("change", (event) => {
                const selected = Array.from(event.target.selectedOptions)
                    .map(option => option.value);
                this.selectedArtistIds = selected;
                if (selected.length === 1) {
                    this.focusedNodeId = selected[0];
                    this.focusOnNode(selected[0]);
                }
            });

        selector.selectAll("option")
            .data(performerNodes)
            .enter()
            .append("option")
            .attr("value", d => d.id)
            .text(d => d.name);
    }

    createForceSimulation(graphNodes, graphLinks) {
        // Clear existing visualization
        this.svg.selectAll("*").remove();

        if (graphNodes.length === 0) return;

        // Create force simulation
        this.simulation = d3.forceSimulation(graphNodes)
            .force("link", d3.forceLink(graphLinks)
                .id(d => d.id)
                .distance(80))
            .force("charge", d3.forceManyBody().strength(-5))
            .force("center", d3.forceCenter(this.width / 2, this.height / 2))
            .force("collision", d3.forceCollide().radius(10));

        // Create links
        const link = this.svg.append("g")
            .selectAll("line")
            .data(graphLinks)
            .enter()
            .append("line")
            .attr("stroke-width", d => this.selectedInfluenceTypes.has(d.edgeType) ? 4 : 1.5)
            .attr("stroke", d => {
                const colors = this.getInfluenceTypeColors();
                const color = d3.color(colors[d.edgeType] || '#7f8c8d');
                color.opacity = this.selectedInfluenceTypes.has(d.edgeType) ? 0.55 : 0.2;
                return color.formatRgb();
            })
            .on("mouseover", (event, d) => {
                d3.select("#tooltip")
                    .style("visibility", "visible")
                    .text(`Influence Type: ${d.edgeType}`)
                    .style("top", (event.pageY + 8) + "px")
                    .style("left", (event.pageX + 8) + "px");
            })
            .on("mouseout", () => {
                d3.select("#tooltip").style("visibility", "hidden");
            });

        // Create nodes
        const node = this.svg.append("g")
            .selectAll("g")
            .data(graphNodes)
            .enter()
            .append("g")
            .call(d3.drag()
                .on("start", this.dragstarted.bind(this))
                .on("drag", this.dragged.bind(this))
                .on("end", this.dragended.bind(this)));

        // Draw node shapes
        node.each((d, i, nodes) => {
            const selection = d3.select(nodes[i]);
            const fontSize = this.focusedNodeId === d.id ? 15 : 10;
            const color = this.getGenreColor(d.genre);

            // Draw shape based on node type
            switch (d.group) {
                case "Person":
                case "Performer":
                    selection.append("circle")
                        .attr("r", 6)
                        .attr("fill", color)
                        .attr("stroke", "#2c3e50")
                        .attr("stroke-width", 2);
                    break;
                case "MusicalGroup":
                    this.drawStar(selection, color);
                    break;
                case "Album":
                    selection.append("rect")
                        .attr("x", -5)
                        .attr("y", -5)
                        .attr("width", 10)
                        .attr("height", 10)
                        .attr("fill", color)
                        .attr("stroke", "#2c3e50")
                        .attr("stroke-width", 2);
                    break;
                case "Song":
                    this.drawTriangle(selection, color);
                    break;
                default:
                    selection.append("circle")
                        .attr("r", 4)
                        .attr("fill", color)
                        .attr("stroke", "#2c3e50")
                        .attr("stroke-width", 2);
            }

            // Add label
            selection.append("text")
                .attr("dx", 6)
                .attr("dy", 3)
                .attr("font-size", fontSize + "px")
                .attr("font-weight", this.focusedNodeId === d.id ? "bold" : "normal")
                .attr("fill", "#2c3e50")
                .text(d.name);
        });

        // Add tooltips to nodes
        node.on("mouseover", (event, d) => {
            d3.select("#tooltip")
                .style("visibility", "visible")
                .text(`${d.name} (${d.genre || d.group})`)
                .style("top", (event.pageY + 8) + "px")
                .style("left", (event.pageX + 8) + "px");
        })
        .on("mouseout", () => {
            d3.select("#tooltip").style("visibility", "hidden");
        });

        // Update positions on tick
        this.simulation.on("tick", () => {
            link
                .attr("x1", d => d.source.x)
                .attr("y1", d => d.source.y)
                .attr("x2", d => d.target.x)
                .attr("y2", d => d.target.y);

            node.attr("transform", d => `translate(${d.x},${d.y})`);
        });
    }

    drawStar(selection, color) {
        const spikes = 5;
        const outerRadius = 6;
        const innerRadius = 3;
        let rot = Math.PI / 2 * 3;
        const step = Math.PI / spikes;
        
        let path = "M0,-6";
        for (let i = 0; i < spikes; i++) {
            const x1 = Math.cos(rot) * outerRadius;
            const y1 = Math.sin(rot) * outerRadius;
            path += `L${x1},${y1}`;
            rot += step;
            const x2 = Math.cos(rot) * innerRadius;
            const y2 = Math.sin(rot) * innerRadius;
            path += `L${x2},${y2}`;
            rot += step;
        }
        path += "Z";

        selection.append("path")
            .attr("d", path)
            .attr("fill", color)
            .attr("stroke", "#2c3e50")
            .attr("stroke-width", 2);
    }

    drawTriangle(selection, color) {
        selection.append("path")
            .attr("d", "M0,-7 L-6,5 L6,5 Z")
            .attr("fill", color)
            .attr("stroke", "#2c3e50")
            .attr("stroke-width", 2);
    }

    focusOnNode(nodeId) {
        if (this.simulation) {
            const node = this.simulation.nodes().find(n => n.id === nodeId);
            if (node) {
                // Implement focus behavior if needed
                this.simulation.alpha(0.3).restart();
            }
        }
    }

    dragstarted(event) {
        if (!event.active) this.simulation.alphaTarget(0.3).restart();
        event.subject.fx = event.subject.x;
        event.subject.fy = event.subject.y;
    }

    dragged(event) {
        event.subject.fx = event.x;
        event.subject.fy = event.y;
    }

    dragended(event) {
        if (!event.active) this.simulation.alphaTarget(0);
        event.subject.fx = null;
        event.subject.fy = null;
    }

    getEdgeType(link) {
        return link.edgeType || link["Edge Type"];
    }

    getNodeType(node) {
        return node.nodeType || node["Node Type"];
    }

    setSelectedInfluenceTypes(types) {
        this.selectedInfluenceTypes = types;
    }

    setMinNotables(min) {
        this.minNotables = min;
    }

    setShowOceanusFolk(show) {
        this.showOceanusFolk = show;
    }
}