/**
 * SAILOR SHIFT - EGO NETWORK VISUALIZATION
 * Visualización interactiva de la red de conexiones de Sailor Shift
 */

// ===== CONFIGURACIÓN GLOBAL =====
const CONFIG = {
    // Dimensiones (se calculan dinámicamente)
    width: 0,
    height: 0,
    
    // Colores por tipo de nodo
    colors: {
        person: "#ff6b6b",    // Rojo para personas
        song: "#4ecdc4",      // Turquesa para canciones
        album: "#45b7d1",     // Azul para álbumes
        group: "#96ceb4",     // Verde para grupos
        label: "#ffd93d"      // Amarillo para sellos
    },
    
    // Tamaños de nodos
    nodeRadius: {
        center: 20,           // Nodo central (Sailor Shift)
        normal: 8,            // Nodos normales
        notable: 12           // Nodos notables
    },
    
    // Configuración de fuerzas
    forces: {
        linkDistance: 100,    // Distancia entre nodos conectados
        chargeStrength: -300, // Fuerza de repulsión
        collisionRadius: 30   // Radio de colisión
    }
};

// ===== VARIABLES GLOBALES =====
let svg, simulation;
let networkData;
let currentView = 'collaboration';
let currentDepth = 1;
let centerNode = null;

// ===== INICIALIZACIÓN PRINCIPAL =====
document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
});

async function initializeApp() {
    try {
        // Cargar datos
        console.log('Cargando datos...');
        const graphData = await d3.json('MC1_graph.json');
        
        // Procesar datos
        console.log('Procesando datos de la red...');
        networkData = processNetworkData(graphData);
        
        if (!networkData) {
            throw new Error('No se pudo procesar los datos de la red');
        }
        
        // Inicializar visualización
        console.log('Inicializando visualización...');
        initializeVisualization();
        createNetwork();
        updateMetrics();
        
        console.log('Visualización lista!');
        
    } catch (error) {
        console.error('Error al inicializar la aplicación:', error);
        showError('Error al cargar los datos. Por favor, verifica que el archivo MC1_graph.json esté disponible.');
    }
}

// ===== PROCESAMIENTO DE DATOS =====
function processNetworkData(graphData) {
    // Buscar el nodo central (Sailor Shift)
    const sailorNode = graphData.nodes.find(n => n.name === "Sailor Shift");
    if (!sailorNode) {
        console.error('No se encontró el nodo "Sailor Shift"');
        return null;
    }
    
    console.log('Nodo central encontrado:', sailorNode.name);
    centerNode = sailorNode;
    
    const nodes = new Map();
    const links = new Map();
    
    // Agregar nodo central
    addNodeToNetwork(nodes, sailorNode, 0, true);
    
    // Procesar conexiones directas (profundidad 1)
    processDirectConnections(graphData, nodes, links, sailorNode);
    
    // Procesar conexiones indirectas (profundidad 2)
    processIndirectConnections(graphData, nodes, links);
    
    const result = {
        nodes: Array.from(nodes.values()),
        links: Array.from(links.values())
    };
    
    console.log(`Red procesada: ${result.nodes.length} nodos, ${result.links.length} enlaces`);
    return result;
}

function addNodeToNetwork(nodes, nodeData, depth, isCenter = false) {
    nodes.set(nodeData.id, {
        id: nodeData.id,
        name: nodeData.name,
        type: nodeData['Node Type'],
        notable: nodeData.notable || false,
        depth: depth,
        center: isCenter
    });
}

function processDirectConnections(graphData, nodes, links, sailorNode) {
    graphData.links.forEach(link => {
        if (link.source === sailorNode.id || link.target === sailorNode.id) {
            const otherId = link.source === sailorNode.id ? link.target : link.source;
            const otherNode = graphData.nodes.find(n => n.id === otherId);
            
            if (otherNode) {
                addNodeToNetwork(nodes, otherNode, 1);
                addLinkToNetwork(links, link);
            }
        }
    });
}

function processIndirectConnections(graphData, nodes, links) {
    nodes.forEach(node => {
        if (node.depth === 1) {
            graphData.links.forEach(link => {
                if (link.source === node.id || link.target === node.id) {
                    const otherId = link.source === node.id ? link.target : link.source;
                    
                    if (!nodes.has(otherId)) {
                        const otherNode = graphData.nodes.find(n => n.id === otherId);
                        if (otherNode) {
                            addNodeToNetwork(nodes, otherNode, 2);
                        }
                    }
                    
                    addLinkToNetwork(links, link);
                }
            });
        }
    });
}

function addLinkToNetwork(links, linkData) {
    const linkId = `${linkData.source}-${linkData.target}`;
    if (!links.has(linkId)) {
        links.set(linkId, {
            source: linkData.source,
            target: linkData.target,
            type: linkData['Edge Type'],
            isInfluence: isInfluenceLink(linkData['Edge Type'])
        });
    }
}

function isInfluenceLink(edgeType) {
    const influenceTypes = ['InStyleOf', 'CoverOf', 'DirectlySamples', 'InterpolatesFrom', 'LyricalReferenceTo'];
    return influenceTypes.includes(edgeType);
}

// ===== INICIALIZACIÓN DE LA VISUALIZACIÓN =====
function initializeVisualization() {
    setupDimensions();
    createSVG();
    createForceSimulation();
    setupEventListeners();
    createLegend();
}

function setupDimensions() {
    const container = document.getElementById('network-view');
    CONFIG.width = container.clientWidth;
    CONFIG.height = container.clientHeight;
    console.log(`Dimensiones: ${CONFIG.width}x${CONFIG.height}`);
}

function createSVG() {
    svg = d3.select('#network-view')
        .append('svg')
        .attr('width', CONFIG.width)
        .attr('height', CONFIG.height);
    
    // Agregar zoom
    const zoom = d3.zoom()
        .scaleExtent([0.1, 4])
        .on('zoom', (event) => {
            svg.select('g').attr('transform', event.transform);
        });
    
    svg.call(zoom);
}

function createForceSimulation() {
    simulation = d3.forceSimulation()
        .force('link', d3.forceLink()
            .id(d => d.id)
            .distance(CONFIG.forces.linkDistance))
        .force('charge', d3.forceManyBody()
            .strength(CONFIG.forces.chargeStrength))
        .force('center', d3.forceCenter(CONFIG.width / 2, CONFIG.height / 2))
        .force('collision', d3.forceCollide()
            .radius(CONFIG.forces.collisionRadius));
}

function setupEventListeners() {
    // Botones de vista
    document.querySelectorAll('.view-toggle').forEach(button => {
        button.addEventListener('click', handleViewToggle);
    });
    
    // Filtro de profundidad
    document.getElementById('depthFilter').addEventListener('change', handleDepthChange);
    
    // Redimensionamiento de ventana
    window.addEventListener('resize', handleWindowResize);
}

// ===== MANEJO DE EVENTOS =====
function handleViewToggle(event) {
    // Actualizar botones
    document.querySelectorAll('.view-toggle').forEach(b => b.classList.remove('active'));
    event.target.classList.add('active');
    
    // Cambiar vista
    currentView = event.target.dataset.view;
    console.log(`Vista cambiada a: ${currentView}`);
    updateVisualization();
}

function handleDepthChange(event) {
    currentDepth = parseInt(event.target.value);
    console.log(`Profundidad cambiada a: ${currentDepth}`);
    updateVisualization();
}

function handleWindowResize() {
    CONFIG.width = document.getElementById('network-view').clientWidth;
    CONFIG.height = document.getElementById('network-view').clientHeight;
    
    svg.attr('width', CONFIG.width)
       .attr('height', CONFIG.height);
    
    simulation.force('center', d3.forceCenter(CONFIG.width / 2, CONFIG.height / 2));
    simulation.alpha(1).restart();
}

// ===== CREACIÓN DE LA RED =====
function createNetwork() {
    console.log('Creando red de visualización...');
    
    // Limpiar SVG anterior
    svg.selectAll('*').remove();
    
    // Crear contenedor principal
    const container = svg.append('g');
    
    // Filtrar datos según configuración actual
    const filteredData = filterNetworkData();
    console.log(`Datos filtrados: ${filteredData.nodes.length} nodos, ${filteredData.links.length} enlaces`);
    
    // Crear elementos visuales
    createLinks(container, filteredData.links);
    createNodes(container, filteredData.nodes);
    createLabels(container, filteredData.nodes);
    
    // Actualizar simulación
    updateSimulation(filteredData);
}

function createLinks(container, links) {
    const linkElements = container.append('g')
        .selectAll('line')
        .data(links)
        .enter()
        .append('line')
        .attr('class', d => d.isInfluence ? 'link-influence' : 'link')
        .style('stroke', '#666')
        .style('stroke-width', d => d.isInfluence ? 2 : 1)
        .style('stroke-opacity', 0.6);
    
    return linkElements;
}

function createNodes(container, nodes) {
    const nodeElements = container.append('g')
        .selectAll('circle')
        .data(nodes)
        .enter()
        .append('circle')
        .attr('r', getNodeRadius)
        .style('fill', getNodeColor)
        .style('stroke', getNodeStroke)
        .style('stroke-width', getNodeStrokeWidth)
        .call(d3.drag()
            .on('start', dragstarted)
            .on('drag', dragged)
            .on('end', dragended))
        .on('mouseover', showNodeTooltip)
        .on('mouseout', hideTooltip)
        .on('click', handleNodeClick);
    
    return nodeElements;
}

function createLabels(container, nodes) {
    const labelElements = container.append('g')
        .selectAll('text')
        .data(nodes)
        .enter()
        .append('text')
        .text(d => d.name)
        .attr('font-size', '10px')
        .attr('fill', '#fff')
        .attr('text-anchor', 'middle')
        .attr('dy', 20);
    
    return labelElements;
}

// ===== FUNCIONES DE ESTILO =====
function getNodeRadius(d) {
    if (d.center) return CONFIG.nodeRadius.center;
    if (d.notable) return CONFIG.nodeRadius.notable;
    return CONFIG.nodeRadius.normal;
}

function getNodeColor(d) {
    return CONFIG.colors[d.type.toLowerCase()] || '#ccc';
}

function getNodeStroke(d) {
    return d.notable ? '#ffd700' : '#fff';
}

function getNodeStrokeWidth(d) {
    return d.notable ? 2 : 1;
}

// ===== FILTRADO DE DATOS =====
function filterNetworkData() {
    // Filtrar nodos por profundidad
    const filteredNodes = networkData.nodes.filter(node => 
        node.depth <= currentDepth || node.center
    );
    
    const nodeIds = new Set(filteredNodes.map(n => n.id));
    
    // Filtrar enlaces por vista y nodos disponibles
    const filteredLinks = networkData.links.filter(link => {
        const matchesView = currentView === 'influence' ? 
            link.isInfluence : 
            !link.isInfluence;
        
        const sourceId = link.source.id || link.source;
        const targetId = link.target.id || link.target;
        
        return matchesView && nodeIds.has(sourceId) && nodeIds.has(targetId);
    });
    
    return { nodes: filteredNodes, links: filteredLinks };
}

// ===== ACTUALIZACIÓN DE LA VISUALIZACIÓN =====
function updateVisualization() {
    createNetwork();
    updateMetrics();
}

function updateSimulation(data) {
    simulation
        .nodes(data.nodes)
        .on('tick', () => {
            // Actualizar posiciones de enlaces
            svg.selectAll('line')
                .attr('x1', d => d.source.x)
                .attr('y1', d => d.source.y)
                .attr('x2', d => d.target.x)
                .attr('y2', d => d.target.y);
            
            // Actualizar posiciones de nodos
            svg.selectAll('circle')
                .attr('cx', d => d.x)
                .attr('cy', d => d.y);
            
            // Actualizar posiciones de etiquetas
            svg.selectAll('text')
                .attr('x', d => d.x)
                .attr('y', d => d.y);
        });
    
    simulation.force('link').links(data.links);
    simulation.alpha(1).restart();
}

// ===== MÉTRICAS Y PANEL DE INFORMACIÓN =====
function updateMetrics() {
    const filteredData = filterNetworkData();
    
    // Contar colaboradores directos
    const collaborators = filteredData.nodes.filter(n => n.depth === 1).length;
    updateMetricValue('collaboratorCount', collaborators);
    
    // Contar alcance de influencia
    const influenceLinks = filteredData.links.filter(l => l.isInfluence).length;
    updateMetricValue('influenceCount', influenceLinks);
    
    // Contar conexiones notables
    const notableNodes = filteredData.nodes.filter(n => n.notable && !n.center).length;
    updateMetricValue('notableCount', notableNodes);
}

function updateMetricValue(elementId, value) {
    const element = document.getElementById(elementId);
    if (element) {
        element.textContent = value;
    }
}

// ===== TOOLTIPS E INTERACTIVIDAD =====
function showNodeTooltip(event, d) {
    const tooltip = d3.select('#tooltip');
    tooltip.style('display', 'block')
        .style('left', (event.pageX + 10) + 'px')
        .style('top', (event.pageY + 10) + 'px')
        .html(createTooltipContent(d));
}

function createTooltipContent(d) {
    return `
        <strong>${d.name}</strong><br>
        Tipo: ${d.type}<br>
        ${d.notable ? '⭐ Notable<br>' : ''}
        Distancia: ${d.depth} paso${d.depth !== 1 ? 's' : ''}
    `;
}

function hideTooltip() {
    d3.select('#tooltip').style('display', 'none');
}

function handleNodeClick(event, d) {
    console.log('Nodo seleccionado:', d.name);
    showNodeDetails(d);
    highlightConnections(d);
}

function showNodeDetails(d) {
    const details = document.getElementById('nodeDetails');
    const title = document.getElementById('nodeTitle');
    const info = document.getElementById('nodeInfo');
    
    details.style.display = 'block';
    title.textContent = d.name;
    info.innerHTML = `
        Tipo: ${d.type}<br>
        ${d.notable ? '⭐ Notable<br>' : ''}
        Distancia en la red: ${d.depth} paso${d.depth !== 1 ? 's' : ''}<br>
    `;
}

function highlightConnections(node) {
    // Resetear opacidad
    svg.selectAll('circle').style('opacity', 0.3);
    svg.selectAll('line').style('opacity', 0.1);
    
    // Resaltar nodo seleccionado
    svg.selectAll('circle')
        .filter(d => d.id === node.id)
        .style('opacity', 1);
    
    // Encontrar conexiones
    const connectedLinks = networkData.links.filter(link => 
        link.source.id === node.id || link.target.id === node.id
    );
    
    const connectedNodes = new Set();
    connectedLinks.forEach(link => {
        connectedNodes.add(link.source.id);
        connectedNodes.add(link.target.id);
    });
    
    // Resaltar nodos y enlaces conectados
    svg.selectAll('circle')
        .filter(d => connectedNodes.has(d.id))
        .style('opacity', 1);
    
    svg.selectAll('line')
        .filter(d => d.source.id === node.id || d.target.id === node.id)
        .style('opacity', 1);
    
    // Restaurar después de 3 segundos
    setTimeout(() => {
        svg.selectAll('circle').style('opacity', 1);
        svg.selectAll('line').style('opacity', 0.6);
    }, 3000);
}

// ===== FUNCIONES DE ARRASTRE =====
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

// ===== LEYENDA =====
function createLegend() {
    const legend = d3.select('#nodeLegend');
    const nodeTypes = Object.entries(CONFIG.colors);
    
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

// ===== MANEJO DE ERRORES =====
function showError(message) {
    const container = document.getElementById('network-view');
    container.innerHTML = `
        <div style="display: flex; justify-content: center; align-items: center; height: 100%; color: #ff6b6b;">
            <div style="text-align: center;">
                <h3>Error</h3>
                <p>${message}</p>
            </div>
        </div>
    `;
} 