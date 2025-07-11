// Main application controller - identical logic to sneeky/2 with data loading
class App {
    constructor() {
        this.networkGraph = new NetworkGraph("#network-graph");
        this.genreMatrix = new GenreMatrix("#genre-matrix");
        this.influencersNetwork = new InfluencersNetwork("#influencers-network");
        
        this.selectedArtistIds = [];
        this.maxHops = 2;
        this.yearRange = [1900, 2025];
        this.influenceMode = 'outgoing';
        this.selectedInfluenceTypes = new Set([
            "InStyleOf", "CoverOf", "DirectlySamples", 
            "LyricalReferenceTo", "InterpolatesFrom"
        ]);
        
        this.allEdgeTypes = [
            "PerformerOf", "ComposerOf", "ProducerOf", "LyricistOf",
            "RecordedBy", "DistributedBy", "InStyleOf", "InterpolatesFrom",
            "CoverOf", "LyricalReferenceTo", "DirectlySamples", "MemberOf"
        ];
        
        this.allNodeTypes = [
            "Person", "Song", "Album", "MusicalGroup", "RecordLabel"
        ];

        this.init();
    }

    async init() {
        try {
            // Load data using identical logic to sneeky/2
            await window.dataLoader.loadGraphData('../MC1_graph.json');
            console.log("Data loaded successfully");
            
            this.setupControls();
            this.setupDefaultSelections();
            this.renderAll();
        } catch (error) {
            console.error("Failed to load data:", error);
            // Try alternative path
            try {
                await window.dataLoader.loadGraphData('MC1_graph.json');
                console.log("Data loaded from alternative path");
                this.setupControls();
                this.setupDefaultSelections();
                this.renderAll();
            } catch (altError) {
                console.error("Failed to load data from alternative path:", altError);
                this.showError("Failed to load data. Please ensure MC1_graph.json is available.");
            }
        }
    }

    setupControls() {
        this.setupArtistSelector();
        this.setupNetworkControls();
        this.setupGenreControls();
        this.setupInfluencersControls();
    }

    setupArtistSelector() {
        const artists = window.dataLoader.getArtists();
        const selector = d3.select("#artist-select");
        
        selector.selectAll("option").remove();
        selector.append("option").attr("value", "").text("Select an artist...");
        
        selector.selectAll("option.artist")
            .data(artists)
            .enter()
            .append("option")
            .attr("class", "artist")
            .attr("value", d => d.id)
            .text(d => d.name || d.stage_name || d.id);

        selector.on("change", (event) => {
            const selectedId = event.target.value;
            if (selectedId) {
                this.selectedArtistIds = [selectedId];
                const selectedNode = artists.find(a => a.id === selectedId);
                if (selectedNode) {
                    this.networkGraph.onNodeClick(selectedNode);
                }
            } else {
                this.selectedArtistIds = [];
            }
            this.renderNetworkGraph();
        });
    }

    setupNetworkControls() {
        // Max hops control
        d3.select("#max-hops").on("change", (event) => {
            this.maxHops = parseInt(event.target.value);
            this.renderNetworkGraph();
        });

        // Node type filters
        const nodeTypeContainer = d3.select("#node-type-filters");
        nodeTypeContainer.selectAll("*").remove();
        
        this.allNodeTypes.forEach(type => {
            const label = nodeTypeContainer.append("label")
                .style("display", "block")
                .style("font-size", "12px")
                .style("margin", "2px 0");
            
            label.append("input")
                .attr("type", "checkbox")
                .property("checked", true)
                .on("change", (event) => {
                    if (event.target.checked) {
                        this.networkGraph.visibleNodeTypes.add(type);
                    } else {
                        this.networkGraph.visibleNodeTypes.delete(type);
                    }
                    this.renderNetworkGraph();
                });
            
            label.append("span").text(" " + type);
        });

        // Edge type filters
        const edgeTypeContainer = d3.select("#edge-type-filters");
        edgeTypeContainer.selectAll("*").remove();
        
        // Select/Deselect all buttons
        const buttonContainer = edgeTypeContainer.append("div")
            .style("margin-bottom", "5px");
        
        buttonContainer.append("button")
            .text("Select All")
            .style("margin-right", "5px")
            .style("font-size", "10px")
            .on("click", () => {
                this.networkGraph.setVisibleEdgeTypes(new Set(this.allEdgeTypes));
                edgeTypeContainer.selectAll("input").property("checked", true);
                this.renderNetworkGraph();
            });
        
        buttonContainer.append("button")
            .text("Deselect All")
            .style("font-size", "10px")
            .on("click", () => {
                this.networkGraph.setVisibleEdgeTypes(new Set());
                edgeTypeContainer.selectAll("input").property("checked", false);
                this.renderNetworkGraph();
            });

        this.allEdgeTypes.forEach(type => {
            const label = edgeTypeContainer.append("label")
                .style("display", "block")
                .style("font-size", "10px")
                .style("margin", "1px 0");
            
            label.append("input")
                .attr("type", "checkbox")
                .property("checked", true)
                .on("change", (event) => {
                    if (event.target.checked) {
                        this.networkGraph.visibleEdgeTypes.add(type);
                    } else {
                        this.networkGraph.visibleEdgeTypes.delete(type);
                    }
                    this.renderNetworkGraph();
                });
            
            label.append("span").text(" " + type);
        });
    }

    setupGenreControls() {
        d3.select("#year-min").on("input", (event) => {
            this.yearRange[0] = parseInt(event.target.value);
            this.renderGenreMatrix();
        });

        d3.select("#year-max").on("input", (event) => {
            this.yearRange[1] = parseInt(event.target.value);
            this.renderGenreMatrix();
        });

        d3.select("#influence-mode").on("change", (event) => {
            this.influenceMode = event.target.value;
            this.renderGenreMatrix();
        });
    }

    setupInfluencersControls() {
        // Influence type checkboxes
        const container = d3.select("#influence-type-checkboxes");
        container.selectAll("*").remove();
        
        const influenceTypes = ["InStyleOf", "CoverOf", "DirectlySamples", "LyricalReferenceTo", "InterpolatesFrom"];
        
        influenceTypes.forEach(type => {
            const label = container.append("label")
                .style("display", "inline-block")
                .style("margin", "5px")
                .style("font-size", "12px");
            
            label.append("input")
                .attr("type", "checkbox")
                .property("checked", this.selectedInfluenceTypes.has(type))
                .on("change", (event) => {
                    if (event.target.checked) {
                        this.selectedInfluenceTypes.add(type);
                    } else {
                        this.selectedInfluenceTypes.delete(type);
                    }
                    this.influencersNetwork.setSelectedInfluenceTypes(this.selectedInfluenceTypes);
                    this.renderInfluencersNetwork();
                });
            
            label.append("span").text(" " + type);
        });

        // Min notables control
        d3.select("#min-notables").on("input", (event) => {
            const minNotables = parseInt(event.target.value);
            this.influencersNetwork.setMinNotables(minNotables);
            this.renderInfluencersNetwork();
        });

        // Show Oceanus Folk checkbox
        d3.select("#show-oceanus-folk").on("change", (event) => {
            this.influencersNetwork.setShowOceanusFolk(event.target.checked);
            this.renderInfluencersNetwork();
        });
    }

    setupDefaultSelections() {
        // Find and select Sailor Shift by default (identical to sneeky/2)
        const nodes = window.dataLoader.nodes;
        const sailor = nodes.find(n => n.name === "Sailor Shift");
        if (sailor) {
            this.selectedArtistIds = [sailor.id];
            d3.select("#artist-select").property("value", sailor.id);
            this.networkGraph.selectedNode = sailor;
        }
    }

    renderAll() {
        this.renderNetworkGraph();
        this.renderGenreMatrix();
        this.renderInfluencersNetwork();
    }

    renderNetworkGraph() {
        if (this.selectedArtistIds.length === 0) {
            const emptyGraph = { nodes: [], links: [] };
            this.networkGraph.render(emptyGraph);
            return;
        }

        const subgraph = window.dataLoader.getSubgraph(this.selectedArtistIds, this.maxHops);
        this.networkGraph.render(subgraph);
    }

    renderGenreMatrix() {
        const nodes = window.dataLoader.nodes;
        const links = window.dataLoader.links;
        this.genreMatrix.render(nodes, links, this.yearRange, this.influenceMode);
    }

    renderInfluencersNetwork() {
        const nodes = window.dataLoader.nodes;
        const links = window.dataLoader.links;
        this.influencersNetwork.render(nodes, links, this.yearRange);
    }

    showError(message) {
        d3.select("body").append("div")
            .style("position", "fixed")
            .style("top", "50%")
            .style("left", "50%")
            .style("transform", "translate(-50%, -50%)")
            .style("background", "#e74c3c")
            .style("color", "white")
            .style("padding", "20px")
            .style("border-radius", "8px")
            .style("z-index", "10000")
            .text(message);
    }
}

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.app = new App();
});