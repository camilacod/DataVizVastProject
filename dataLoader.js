// Data loading functionality identical to sneeky/2
class DataLoader {
    constructor() {
        this.nodes = [];
        this.links = [];
        this.loaded = false;
    }

    async loadGraphData(url = 'MC1_graph.json') {
        try {
            const response = await fetch(url);
            const raw = await response.json();
            
            // Process nodes - filter notable works and normalize IDs
            this.nodes = raw.nodes.filter(n => {
                return (n.nodeType === 'Song' || n.nodeType === 'Album') ? n.notable : true;
            }).map(n => ({ ...n, id: String(n.id) }));

            // Process links - normalize source/target IDs
            this.links = raw.links.map(l => ({
                ...l,
                source: String(l.source),
                target: String(l.target),
            }));

            this.loaded = true;
            return { nodes: this.nodes, links: this.links };
        } catch (error) {
            console.error("Error loading graph data:", error);
            throw error;
        }
    }

    // Get all artists (Person nodes) sorted alphabetically
    getArtists() {
        if (!this.loaded) return [];
        
        const rolesByPerson = {};
        
        // Calculate roles for each person
        for (const link of this.links) {
            const type = link["Edge Type"];
            const source = link.source;
            const srcNode = this.nodes.find(n => n.id === source);
            if (srcNode?.["Node Type"] === "Person") {
                if (!rolesByPerson[source]) rolesByPerson[source] = new Set();
                rolesByPerson[source].add(type);
            }
        }

        const persons = this.nodes
            .filter(n => n["Node Type"] === "Person")
            .sort((a, b) =>
                (a.name || a.stage_name || "").localeCompare(
                    b.name || b.stage_name || "",
                    undefined,
                    { sensitivity: "base" }
                )
            );

        // Add roles property to enriched data
        return persons.map(p => ({
            ...p,
            roles: rolesByPerson[p.id] || new Set(),
        }));
    }

    // Get subgraph around selected artists within maxHops
    getSubgraph(selectedArtistIds, maxHops = 2) {
        if (!this.loaded || selectedArtistIds.length === 0) {
            return { nodes: [], links: [] };
        }

        const reachable = new Set(selectedArtistIds);
        let frontier = new Set(selectedArtistIds);
        
        const linkKeys = new Set();
        const selectedLinks = [];

        for (let hop = 1; hop <= maxHops; hop++) {
            // Find all edges touching the current frontier
            const newLinks = this.links.filter(
                l => frontier.has(l.source) || frontier.has(l.target)
            );
            
            // Dedupe and collect
            newLinks.forEach(l => {
                const key = `${l.source}-${l.target}-${l["Edge Type"]}`;
                if (!linkKeys.has(key)) {
                    linkKeys.add(key);
                    selectedLinks.push(l);
                }
            });
            
            // Build the next frontier
            const candidates = new Set();
            newLinks.forEach(l => {
                candidates.add(l.source);
                candidates.add(l.target);
            });
            
            const prevReachable = new Set(reachable);
            frontier = new Set(
                [...candidates].filter(id => !prevReachable.has(id))
            );
            
            // Merge into reachable
            frontier.forEach(id => reachable.add(id));
        }

        // Get nodes and links in the n-hop neighborhood
        const subNodes = this.nodes.filter(n => reachable.has(n.id));
        return { nodes: subNodes, links: selectedLinks };
    }

    // Get Sailor Shift genres for highlighting
    getSailorShiftGenres() {
        if (!this.loaded) return new Set();
        
        // Find Sailor Shift node
        const sailorShift = this.nodes.find(n => n.name === "Sailor Shift");
        if (!sailorShift) return new Set();

        // Get all works connected to Sailor Shift
        const sailorWorks = this.links
            .filter(l => l.source === sailorShift.id)
            .map(l => this.nodes.find(n => n.id === l.target))
            .filter(Boolean);

        // Extract unique genres
        return new Set(sailorWorks.map(w => w.genre).filter(Boolean));
    }
}

// Global data loader instance
window.dataLoader = new DataLoader();