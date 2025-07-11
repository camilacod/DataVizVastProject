// Network Graph implementation with modified colors
class NetworkGraph {
    constructor(containerId) {
        this.container = d3.select(containerId);
        this.width = 1200;
        this.height = 600;
        this.selectedNode = null;
        this.visibleNodeTypes = new Set([
            "Person", "Song", "Album", "MusicalGroup", "RecordLabel"
        ]);
        this.visibleEdgeTypes = new Set([
            "PerformerOf", "ComposerOf", "ProducerOf", "LyricistOf",
            "RecordedBy", "DistributedBy", "InStyleOf", "InterpolatesFrom",
            "CoverOf", "LyricalReferenceTo", "DirectlySamples", "MemberOf"
        ]);
        this.simulation = null;
        this.tooltip = d3.select("#tooltip");
        
        this.setupSVG();
        this.setupEdgeDescriptions();
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

    setupSVG() {
        this.svg = this.container
            .attr("width", this.width)
            .attr("height", this.height);

        // Create zoom behavior
        this.zoom = d3.zoom()
            .scaleExtent([0.1, 5])
            .on("zoom", (event) => {
                this.container.select("g.content")
                    .attr("transform", event.transform);
            });

        this.svg.call(this.zoom);
        
        // Main container
        this.g = this.svg.append("g").attr("class", "content");
        
        // Define groups for layers
        this.linksGroup = this.g.append("g").attr("class", "links");
        this.nodesGroup = this.g.append("g").attr("class", "nodes");
        this.labelsGroup = this.g.append("g").attr("class", "labels");
    }

    // Modified colors - different from original
    getNodeColor(nodeType) {
        switch (nodeType) {
            case "Person": return "#e74c3c";        // Red instead of green
            case "Song": return "#f39c12";          // Orange instead of light green  
            case "Album": return "#9b59b6";         // Purple instead of dark green
            case "MusicalGroup": return "#3498db";  // Blue instead of light green
            case "RecordLabel": return "#f1c40f";   // Yellow instead of light yellow
            default: return "#95a5a6";              // Gray
        }
    }

    getNodeShape(nodeType) {
        const shapes = {
            Person: d3.symbolCircle,
            Song: d3.symbolTriangle,
            Album: d3.symbolSquare,
            MusicalGroup: d3.symbolStar,
            RecordLabel: d3.symbolDiamond,
        };
        return shapes[nodeType] || d3.symbolCircle;
    }

    render(graph) {
        this.currentGraph = graph;
        
        // Filter nodes and links based on visibility
        const filteredNodes = graph.nodes.filter(n => 
            this.visibleNodeTypes.has(n["Node Type"])
        );
        const nodeIds = new Set(filteredNodes.map(n => n.id));
        
        const filteredLinks = graph.links.filter(l =>
            this.visibleEdgeTypes.has(l["Edge Type"]) &&
            nodeIds.has(l.source) &&
            nodeIds.has(l.target)
        );

        // Process links with source/target objects
        const linkData = filteredLinks.map(l => ({
            sourceId: l.source,
            targetId: l.target,
            edgeType: l["Edge Type"],
            source: filteredNodes.find(n => n.id === l.source),
            target: filteredNodes.find(n => n.id === l.target),
        }));

        // Group edges for curved paths
        const edgeGroups = d3.group(linkData, d => 
            [d.source.id, d.target.id].sort().join("__")
        );

        this.updateVisualization(filteredNodes, linkData, edgeGroups);
    }

    updateVisualization(nodes, links, edgeGroups) {
        // Stop existing simulation
        if (this.simulation) {
            this.simulation.stop();
        }

        // Clear existing elements
        this.svg.selectAll("defs").remove();
        
        // Create gradients for edges - modified colors
        const defs = this.svg.append("defs");
        links.forEach(d => {
            const id = `grad-${d.source.id}-${d.target.id}-${d.edgeType}`;
            const lg = defs.append("linearGradient")
                .attr("id", id)
                .attr("gradientUnits", "userSpaceOnUse");
            lg.append("stop").attr("offset", "0%").attr("stop-color", "#e67e22"); // Orange
            lg.append("stop").attr("offset", "50%").attr("stop-color", "#ecf0f1"); // Light gray
            lg.append("stop").attr("offset", "100%").attr("stop-color", "#8e44ad"); // Purple
        });

        // Update links
        const link = this.linksGroup
            .selectAll("path")
            .data(links, d => `${d.source.id}-${d.target.id}-${d.edgeType}`);

        link.exit().remove();

        link.enter()
            .append("path")
            .merge(link)
            .attr("fill", "none")
            .attr("stroke-width", 1)
            .attr("stroke", d => `url(#grad-${d.source.id}-${d.target.id}-${d.edgeType})`)
            .style("opacity", 0.6)
            .on("mouseover", (event, d) => this.showEdgeTooltip(event, d))
            .on("mousemove", (event) => this.moveTooltip(event))
            .on("mouseout", () => this.hideTooltip())
            .on("click", (event, d) => this.createPinnedTooltip(event, d));

        // Update nodes
        const node = this.nodesGroup
            .selectAll("path")
            .data(nodes, d => d.id);

        node.exit().remove();

        const symbolGenerator = d3.symbol()
            .type(d => this.getNodeShape(d["Node Type"]))
            .size(d => d.id === this.selectedNode?.id ? 600 : 200);

        node.enter()
            .append("path")
            .merge(node)
            .attr("d", symbolGenerator)
            .attr("fill", d => this.getNodeColor(d["Node Type"]))
            .attr("stroke", "#2c3e50") // Dark blue-gray stroke
            .attr("stroke-width", 2)
            .style("cursor", "pointer")
            .on("click", (event, d) => this.onNodeClick(d))
            .call(this.createDragBehavior());

        // Update labels
        const label = this.labelsGroup
            .selectAll("text")
            .data(nodes, d => d.id);

        label.exit().remove();

        label.enter()
            .append("text")
            .merge(label)
            .text(d => d.name || d.stage_name || d.id)
            .attr("font-size", d => d.id === this.selectedNode?.id ? 12 : 8)
            .attr("font-weight", d => d.id === this.selectedNode?.id ? "bold" : "normal")
            .attr("dx", 6)
            .attr("dy", 2)
            .attr("fill", "#2c3e50"); // Dark text color

        // Create and start simulation
        this.simulation = d3.forceSimulation(nodes)
            .force("link", d3.forceLink(links)
                .id(d => d.id)
                .distance(120))
            .force("charge", d3.forceManyBody().strength(-200))
            .force("center", d3.forceCenter(this.width / 2, this.height / 2))
            .force("collision", d3.forceCollide().radius(30))
            .on("tick", () => this.tick(link, node, label, edgeGroups));
    }

    tick(link, node, label, edgeGroups) {
        // Update link paths with curves
        link.attr("d", d => {
            const key = [d.source.id, d.target.id].sort().join("__");
            const grp = edgeGroups.get(key);
            const idx = grp.indexOf(d);
            const cnt = grp.length;
            const curve = (idx - (cnt - 1) / 2) * 6;
            
            const { x: x1, y: y1 } = d.source;
            const { x: x2, y: y2 } = d.target;
            const mx = (x1 + x2) / 2;
            const my = (y1 + y2) / 2;
            const dx = y2 - y1;
            const dy = x1 - x2;
            const len = Math.hypot(dx, dy) || 1;
            const ux = dx / len;
            const uy = dy / len;
            const cx = mx + ux * curve;
            const cy = my + uy * curve;
            
            return `M${x1},${y1} Q${cx},${cy} ${x2},${y2}`;
        });

        // Update gradient positions
        link.each(d => {
            this.svg.select(`#grad-${d.source.id}-${d.target.id}-${d.edgeType}`)
                .attr("x1", d.source.x)
                .attr("y1", d.source.y)
                .attr("x2", d.target.x)
                .attr("y2", d.target.y);
        });

        // Update node positions
        node.attr("transform", d => `translate(${d.x},${d.y})`);

        // Update label positions
        label.attr("x", d => d.x).attr("y", d => d.y);
    }

    createDragBehavior() {
        return d3.drag()
            .on("start", (event) => {
                if (!event.active) this.simulation.alphaTarget(0.3).restart();
                event.subject.fx = event.subject.x;
                event.subject.fy = event.subject.y;
            })
            .on("drag", (event) => {
                event.subject.fx = event.x;
                event.subject.fy = event.y;
            })
            .on("end", (event) => {
                if (!event.active) this.simulation.alphaTarget(0);
                event.subject.fx = null;
                event.subject.fy = null;
            });
    }

    showEdgeTooltip(event, d) {
        const src = d.source.name || d.source.stage_name || d.source.id;
        const tgt = d.target.name || d.target.stage_name || d.target.id;
        const desc = this.edgeDescriptions[d.edgeType] || 
                    ((s, t) => `${d.edgeType}: ${s}→${t}`);
        
        this.tooltip
            .style("visibility", "visible")
            .text(desc(src, tgt));
    }

    moveTooltip(event) {
        this.tooltip
            .style("top", `${event.pageY + 8}px`)
            .style("left", `${event.pageX + 8}px`);
    }

    hideTooltip() {
        this.tooltip.style("visibility", "hidden");
    }

    createPinnedTooltip(event, d) {
        const src = d.source.name || d.source.stage_name || d.source.id;
        const tgt = d.target.name || d.target.stage_name || d.target.id;
        const desc = this.edgeDescriptions[d.edgeType] || 
                    ((s, t) => `${d.edgeType}: ${s}→${t}`);
        
        const pinnedTooltip = d3.select("body")
            .append("div")
            .attr("class", "tooltip pinned-tooltip")
            .style("position", "absolute")
            .style("top", `${event.pageY + 8}px`)
            .style("left", `${event.pageX + 8}px`)
            .style("background", "white")
            .style("border", "1px solid #ccc")
            .style("padding", "8px")
            .style("border-radius", "4px")
            .style("box-shadow", "0px 2px 6px rgba(0,0,0,0.2)")
            .style("visibility", "visible")
            .html(`
                <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px;">
                    <span>${desc(src, tgt)}</span>
                    <button class="close-tooltip" style="background: none; border: none; font-size: 14px; cursor: pointer; padding: 0; margin: 0;">✖</button>
                </div>
            `);

        pinnedTooltip.select(".close-tooltip").on("click", () => {
            pinnedTooltip.remove();
        });
    }

    onNodeClick(node) {
        this.selectedNode = node;
        if (this.onNodeClickCallback) {
            this.onNodeClickCallback(node);
        }
        // Re-render to update selected node styling
        if (this.currentGraph) {
            this.render(this.currentGraph);
        }
    }

    setNodeClickCallback(callback) {
        this.onNodeClickCallback = callback;
    }

    setVisibleNodeTypes(types) {
        this.visibleNodeTypes = types;
    }

    setVisibleEdgeTypes(types) {
        this.visibleEdgeTypes = types;
    }
}