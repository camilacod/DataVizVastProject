// Configuration
const config = {
    width: 0,
    height: 0,
    colors: {
        person: "#e74c3c", // red
        song: "#3498db",   // blue
        album: "#f1c40f",  // yellow
        group: "#9b59b6",  // purple
        label: "#27ae60",   // green
        musicalgroup: "#ffffff",
    },
    nodeRadius: {
        center: 10, // was 20, now smaller for Sailor Shift
        normal: 8,
        notable: 12
    }
};

// Initialize visualization
let svg, simulation;
let networkData;
let currentView = 'collaboration';
let currentDepth = 1;
let centerNode = null;

// Load and process data
Promise.all([
    d3.json('MC1_graph.json')
]).then(([graphData]) => {
    // Process data for network visualization
    networkData = processNetworkData(graphData);
    
    // Initialize visualization
    initializeVisualization();
    createNetwork();
    updateMetrics();
    
}).catch(error => {
    console.error('Error loading data:', error);
});

function processNetworkData(graphData) {
    // Find Sailor Shift's node
    const sailorNode = graphData.nodes.find(n => n.name === "Sailor Shift");
    if (!sailorNode) return null;

    centerNode = sailorNode;

    const nodes = new Map();
    const links = new Map();

    // Add center node
    nodes.set(sailorNode.id, {
        id: sailorNode.id,
        name: sailorNode.name,
        type: sailorNode['Node Type'],
        notable: sailorNode.notable || false,
        depth: 0,
        center: true
    });

    // Process direct connections (depth 1)
    graphData.links.forEach(link => {
        if (link.source === sailorNode.id || link.target === sailorNode.id) {
            const isSource = link.source === sailorNode.id;
            const otherId = isSource ? link.target : link.source;
            const otherNode = graphData.nodes.find(n => n.id === otherId);
            
            if (!otherNode) return;

            // Add node if not exists
            if (!nodes.has(otherId)) {
                nodes.set(otherId, {
                    id: otherId,
                    name: otherNode.name,
                    type: otherNode['Node Type'],
                    notable: otherNode.notable || false,
                    depth: 1
                });
            } else {
                // If node already exists, set depth to 1 if it's less than current
                if (nodes.get(otherId).depth > 1) {
                    nodes.get(otherId).depth = 1;
                }
            }

            // Add link
            const linkId = `${link.source}-${link.target}`;
            if (!links.has(linkId)) {
                links.set(linkId, {
                    source: link.source,
                    target: link.target,
                    type: link['Edge Type'],
                    isInfluence: ['InStyleOf', 'CoverOf', 'DirectlySamples', 'InterpolatesFrom', 'LyricalReferenceTo'].includes(link['Edge Type'])
                });
            }
        }
    });

    // Process indirect connections (depth 2)
    nodes.forEach(node => {
        if (node.depth === 1) {
            graphData.links.forEach(link => {
                if (link.source === node.id || link.target === node.id) {
                    const isSource = link.source === node.id;
                    const otherId = isSource ? link.target : link.source;
                    // Do not add Sailor Shift again
                    if (otherId === sailorNode.id) return;
                    const otherNode = graphData.nodes.find(n => n.id === otherId);
                    if (!otherNode) return;

                    // Only add as depth 2 if not already present
                    if (!nodes.has(otherId)) {
                        nodes.set(otherId, {
                            id: otherId,
                            name: otherNode.name,
                            type: otherNode['Node Type'],
                            notable: otherNode.notable || false,
                            depth: 2
                        });
                    }

                    const linkId = `${link.source}-${link.target}`;
                    if (!links.has(linkId)) {
                        links.set(linkId, {
                            source: link.source,
                            target: link.target,
                            type: link['Edge Type'],
                            isInfluence: ['InStyleOf', 'CoverOf', 'DirectlySamples', 'InterpolatesFrom', 'LyricalReferenceTo'].includes(link['Edge Type'])
                        });
                    }
                }
            });
        }
    });

    return {
        nodes: Array.from(nodes.values()),
        links: Array.from(links.values())
    };
}

function initializeVisualization() {
    // Set dimensions
    const container = document.getElementById('network-view');
    config.width = container.clientWidth;
    config.height = container.clientHeight;

    // Create SVG
    svg = d3.select('#network-view')
        .append('svg')
        .attr('width', config.width)
        .attr('height', config.height);

    // Add zoom behavior
    const zoom = d3.zoom()
        .scaleExtent([0.1, 4])
        .on('zoom', (event) => {
            svg.select('g').attr('transform', event.transform);
        });

    svg.call(zoom);

    // Create force simulation
    simulation = d3.forceSimulation()
        .force('link', d3.forceLink().id(d => d.id).distance(100))
        .force('charge', d3.forceManyBody().strength(-300))
        .force('center', d3.forceCenter(config.width / 2, config.height / 2))
        .force('collision', d3.forceCollide().radius(30));

    // Add event listeners
    document.querySelectorAll('.view-toggle').forEach(button => {
        button.addEventListener('click', (event) => {
            document.querySelectorAll('.view-toggle').forEach(b => b.classList.remove('active'));
            event.target.classList.add('active');
            currentView = event.target.dataset.view;
            updateVisualization();
            centerOnSailorShift();
        });
    });

    document.getElementById('depthFilter').addEventListener('change', (event) => {
        currentDepth = parseInt(event.target.value);
        updateVisualization();
        centerOnSailorShift();
    });

    // Create legend
    createLegend();
}

function createLegend() {
    const legend = d3.select('#nodeLegend');
    const nodeTypes = Object.entries(config.colors);

    const legendItems = legend.selectAll('.legend-item')
        .data(nodeTypes)
        .enter()
        .append('div')
        .attr('class', 'legend-item');

    legendItems.append('div')
        .attr('class', 'legend-color')
        .style('background', d => d[1]);

    legendItems.append('span')
        .text(d => d[0].charAt(0).toUpperCase() + d[0].slice(1));
}

function createNetwork() {
    // Clear previous
    svg.selectAll('*').remove();

    const container = svg.append('g');

    // Filter data based on current view and depth
    const filteredData = filterNetworkData();

    // Create links
    const links = container.append('g')
        .selectAll('line')
        .data(filteredData.links)
        .enter()
        .append('line')
        .attr('class', d => d.isInfluence ? 'link-influence' : 'link')
        .style('stroke', '#666')
        .style('stroke-width', d => d.isInfluence ? 2 : 1)
        .style('stroke-opacity', 1);

    // Create nodes
    const nodes = container.append('g')
        .selectAll('circle')
        .data(filteredData.nodes)
        .enter()
        .append('circle')
        .attr('r', d => d.center ? config.nodeRadius.center : 
                      d.notable ? config.nodeRadius.notable : 
                      config.nodeRadius.normal)
        .style('fill', d => config.colors[d.type.toLowerCase()])
        // Highlight edges: Sailor Shift gets no border, others get gold thick border
        .style('stroke-width', d => d.center ? 0 : 3)
        .call(d3.drag()
            .on('start', dragstarted)
            .on('drag', dragged)
            .on('end', dragended))
        .on('mouseover', showNodeTooltip)
        .on('mouseout', hideTooltip)
        .on('click', handleNodeClick);

    // Add labels
    const labels = container.append('g')
        .selectAll('text')
        .data(filteredData.nodes)
        .enter()
        .append('text')
        .text(d => d.name)
        .attr('font-size', '10px')
        .attr('fill', '#fff')
        .attr('text-anchor', 'middle')
        .attr('dy', 20);

    // Update simulation
    simulation
        .nodes(filteredData.nodes)
        .on('tick', () => {
            links
                .attr('x1', d => d.source.x)
                .attr('y1', d => d.source.y)
                .attr('x2', d => d.target.x)
                .attr('y2', d => d.target.y);

            nodes
                .attr('cx', d => d.x)
                .attr('cy', d => d.y);

            labels
                .attr('x', d => d.x)
                .attr('y', d => d.y);
        });

    simulation.force('link')
        .links(filteredData.links);

    simulation.alpha(1).restart();
}

function filterNetworkData() {
    const nodes = networkData.nodes.filter(node => 
        node.depth <= currentDepth || node.center
    );

    const nodeIds = new Set(nodes.map(n => n.id));

    const links = networkData.links.filter(link => {
        const matchesView = currentView === 'influence' ? 
            link.isInfluence : 
            !link.isInfluence;
        
        return matchesView && 
               nodeIds.has(link.source.id || link.source) && 
               nodeIds.has(link.target.id || link.target);
    });

    return { nodes, links };
}

function updateVisualization() {
    createNetwork();
    updateMetrics();
}

function updateMetrics() {
    const filteredData = filterNetworkData();
    
    // Count direct collaborators
    const collaborators = filteredData.nodes.filter(n => n.depth === 1).length;
    document.getElementById('collaboratorCount').textContent = collaborators;

    // Count influence reach
    const influenceLinks = filteredData.links.filter(l => l.isInfluence).length;
    document.getElementById('influenceCount').textContent = influenceLinks;

    // Count notable connections
    const notableNodes = filteredData.nodes.filter(n => n.notable && !n.center).length;
    document.getElementById('notableCount').textContent = notableNodes;
}

function showNodeTooltip(event, d) {
    const tooltip = d3.select('#tooltip');
    tooltip.style('display', 'block')
        .style('left', (event.pageX + 10) + 'px')
        .style('top', (event.pageY + 10) + 'px')
        .html(`
            <strong>${d.name}</strong><br>
            Type: ${d.type}<br>
            ${d.notable ? '⭐ Notable' : ''}<br>
            Distance: ${d.depth} step${d.depth !== 1 ? 's' : ''}
        `);
}

function hideTooltip() {
    d3.select('#tooltip').style('display', 'none');
}

function handleNodeClick(event, d) {
    // Update node details panel
    const details = document.getElementById('nodeDetails');
    const title = document.getElementById('nodeTitle');
    const info = document.getElementById('nodeInfo');

    details.style.display = 'block';
    title.textContent = d.name;
    info.innerHTML = `
        Type: ${d.type}<br>
        ${d.notable ? '⭐ Notable<br>' : ''}
        Network Distance: ${d.depth} step${d.depth !== 1 ? 's' : ''}<br>
    `;

    // Highlight connected nodes
    highlightConnections(d);
}

function highlightConnections(node) {
    // Reset all nodes and links
    svg.selectAll('circle')
        .style('opacity', 0.3);
    
    svg.selectAll('line')
        .style('opacity', );

    // Highlight selected node
    svg.selectAll('circle')
        .filter(d => d.id === node.id)
        .style('opacity', 1);

    // Highlight connected nodes and links
    const connectedLinks = networkData.links.filter(link => 
        link.source.id === node.id || link.target.id === node.id
    );

    const connectedNodes = new Set();
    connectedLinks.forEach(link => {
        connectedNodes.add(link.source.id);
        connectedNodes.add(link.target.id);
    });

    svg.selectAll('circle')
        .filter(d => connectedNodes.has(d.id))
        .style('opacity', 1);

    svg.selectAll('line')
        .filter(d => d.source.id === node.id || d.target.id === node.id)
        .style('opacity', 1);

    // Reset after delay
    setTimeout(() => {
        svg.selectAll('circle').style('opacity', 1);
        svg.selectAll('line').style('opacity', 0.6);
    }, 3000);
}

function dragstarted(event) {
    if (!event.active) simulation.alphaTarget(0.3).restart();
    event.subject.fx = event.subject.x;
    event.subject.fy = event.subject.y;
}

function dragged(event) {
    event.subject.fx = event.x;
    event.subject.fy = event.y;
}

function dragended(event) {
    if (!event.active) simulation.alphaTarget(0);
    event.subject.fx = null;
    event.subject.fy = null;
}

// Add a function to center on Sailor Shift
function centerOnSailorShift() {
    // Find the main group (g) inside the svg
    const svgElem = d3.select('#network-view svg');
    const container = svgElem.select('g');
    // Find Sailor Shift node in the current simulation
    if (!simulation || !simulation.nodes) return;
    const sailor = simulation.nodes().find(n => n.center);
    if (sailor) {
        const width = config.width;
        const height = config.height;
        const dx = width / 2 - sailor.x;
        const dy = height / 2 - sailor.y;
        container.attr('transform', `translate(${dx},${dy})`);
    }
}

// Handle window resize
window.addEventListener('resize', () => {
    config.width = document.getElementById('network-view').clientWidth;
    config.height = document.getElementById('network-view').clientHeight;

    svg.attr('width', config.width)
       .attr('height', config.height);

    simulation.force('center', d3.forceCenter(config.width / 2, config.height / 2));
    simulation.alpha(1).restart();
});