/**
 * SAILOR SHIFT - RED MUSICAL SIMPLE
 * Visualización limpia de la red de Sailor Shift
 */

// ===== CONFIGURACIÓN =====
const CONFIG = {
    colors: {
        person: "#ff6b6b",
        song: "#4ecdc4", 
        album: "#a259f7",
        musicalgroup: "#2ecc40",
        recordlabel: "#ffd93d"
    },
    
    nodeSizes: {
        center: 50,      // Sailor Shift (nodo central) - Mucho más grande
        normal: 8,       // Nodos normales
        notable: 12      // Nodos notables (canciones/álbumes exitosos)
    },
    
    forces: {
        linkDistance: 200,    // Aumentado: más distancia entre nodos conectados
        chargeStrength: -800, // Aumentado: más repulsión entre nodos
        collisionRadius: 50   // Aumentado: más espacio entre nodos
    }
};

// ===== VARIABLES GLOBALES =====
let graphData = null;
let svg, simulation;
let currentView = 'collaborations';
let selectedNode = null; // Para tracking del nodo seleccionado
let allNodes = null, allLinks = null, allLabels = null; // Referencias a elementos
let artistHighlightActive = false; // Para tracking del highlight de artistas

// ===== INICIALIZACIÓN =====
document.addEventListener('DOMContentLoaded', async function() {
    try {
        console.log('🚀 Inicializando red de Sailor Shift...');
        
        // Cargar datos
        graphData = await d3.json('MC1_graph.json');
        console.log('✅ Datos cargados:', graphData.nodes.length, 'nodos,', graphData.links.length, 'enlaces');
        
        // Configurar eventos
        setupEventListeners();
        
        // Crear visualización
        createNetwork();
        
        // Actualizar estado inicial del botón de artistas
        updateArtistButtonState();
        
        console.log('🎉 Red lista!');
        
    } catch (error) {
        console.error('❌ Error al inicializar:', error);
    }
});

// ===== CONFIGURACIÓN DE EVENTOS =====
function setupEventListeners() {
    document.getElementById('collaborations-btn').addEventListener('click', () => {
        switchView('collaborations');
    });
    
    document.getElementById('influences-btn').addEventListener('click', () => {
        switchView('influences');
    });
    
    document.getElementById('highlight-artists-btn').addEventListener('click', () => {
        toggleArtistHighlight();
    });
}

// ===== CAMBIO DE VISTA =====
function switchView(view) {
    currentView = view;
    
    // Desactivar highlight de artistas si está activo
    if (artistHighlightActive) {
        artistHighlightActive = false;
        const btn = document.getElementById('highlight-artists-btn');
        if (btn) btn.classList.remove('active');
    }
    
    // Actualizar botones
    document.querySelectorAll('.view-btn').forEach(btn => btn.classList.remove('active'));
    document.getElementById(`${view}-btn`).classList.add('active');
    
    // Actualizar estado del botón de resaltar artistas
    updateArtistButtonState();
    
    // Recargar red
    updateNetwork();
}

// ===== ACTUALIZAR ESTADO DEL BOTÓN DE ARTISTAS =====
function updateArtistButtonState() {
    const btn = document.getElementById('highlight-artists-btn');
    if (!btn) return;
    
    if (currentView === 'collaborations') {
        // Habilitar botón en vista de colaboraciones
        btn.classList.remove('disabled');
        btn.style.opacity = '1';
        btn.style.cursor = 'pointer';
        btn.title = 'Resaltar colaboraciones con artistas';
    } else {
        // Deshabilitar botón en vista de influencias
        btn.classList.add('disabled');
        btn.style.opacity = '0.5';
        btn.style.cursor = 'not-allowed';
        btn.title = 'Solo disponible en vista de Colaboraciones';
    }
}

// ===== FUNCIÓN PARA REFRESCAR LA VISTA =====
function refreshNetwork() {
    updateNetwork();
}

// ===== CREACIÓN DE LA RED =====
function createNetwork() {
    const container = document.getElementById('network-container');
    const width = container.clientWidth;
    const height = container.clientHeight;
    
    // Crear SVG
    svg = d3.select('#network-container')
        .append('svg')
        .attr('width', width)
        .attr('height', height);
    
    // Cargar vista inicial
    updateNetwork();
}

// ===== ACTUALIZACIÓN DE LA RED =====
function updateNetwork() {
    // Detener simulación anterior si existe
    if (simulation) {
        simulation.stop();
        simulation = null;
    }
    
    // Limpiar SVG completamente
    svg.selectAll('*').remove();
    
    // Resetear referencias
    selectedNode = null;
    allNodes = null;
    allLinks = null;
    allLabels = null;
    
    // Procesar datos según la vista actual
    const data = processNetworkData();
    
    // Crear visualización
    createVisualization(data);
}

// ===== PROCESAMIENTO DE DATOS =====
function processNetworkData() {
    const sailorNode = graphData.nodes.find(n => n.name === "Sailor Shift");
    if (!sailorNode) return { nodes: [], links: [] };
    
    const nodes = new Map();
    const links = new Map();
    
    // Agregar Sailor Shift como nodo central
    nodes.set(sailorNode.id, {
        ...sailorNode,
        isCenter: true,
        depth: 0
    });
    
    // Definir tipos de conexión según la vista
    let connectionTypes = [];
    if (currentView === 'collaborations') {
        connectionTypes = ['PerformerOf', 'ComposerOf', 'ProducerOf', 'LyricistOf', 'MemberOf'];
    } else {
        connectionTypes = ['InStyleOf', 'CoverOf', 'DirectlySamples', 'InterpolatesFrom', 'LyricalReferenceTo'];
    }
    
    // Primera pasada: encontrar conexiones directas con Sailor Shift
    const directConnections = new Set();
    const musicalGroups = new Set();
    
    graphData.links.forEach(link => {
        if (connectionTypes.includes(link['Edge Type'])) {
            const sourceId = typeof link.source === 'object' ? link.source.id : link.source;
            const targetId = typeof link.target === 'object' ? link.target.id : link.target;
            
            if (sourceId === sailorNode.id || targetId === sailorNode.id) {
                const otherId = sourceId === sailorNode.id ? targetId : sourceId;
                const otherNode = graphData.nodes.find(n => n.id === otherId);
                
                if (otherNode) {
                    directConnections.add(otherId);
                    nodes.set(otherId, {
                        ...otherNode,
                        depth: 1,
                        isCenter: false
                    });
                    
                    // Si es un grupo musical, lo marcamos para expandir
                    if (otherNode['Node Type'] === 'MusicalGroup') {
                        musicalGroups.add(otherId);
                    }
                    
                    const linkId = `${sourceId}-${targetId}`;
                    const isInfluence = currentView === 'influences';
                    const direction = sourceId === sailorNode.id ? 'out' : 'in';
                    
                    links.set(linkId, {
                        source: sourceId,
                        target: targetId,
                        type: link['Edge Type'],
                        isInfluence: isInfluence,
                        direction: direction,
                        relationship: getRelationshipDescription(link['Edge Type'], direction)
                    });
                }
            }
        }
    });
    
    // Segunda pasada: expandir grupos musicales para incluir todos sus miembros
    if (currentView === 'collaborations') {
        graphData.links.forEach(link => {
            if (link['Edge Type'] === 'MemberOf') {
                const sourceId = typeof link.source === 'object' ? link.source.id : link.source;
                const targetId = typeof link.target === 'object' ? link.target.id : link.target;
                
                // Si el grupo está en nuestra red, agregar al miembro
                if (musicalGroups.has(targetId)) {
                    const memberNode = graphData.nodes.find(n => n.id === sourceId);
                    
                    if (memberNode && !directConnections.has(sourceId) && !nodes.has(sourceId)) {
                        nodes.set(sourceId, {
                            ...memberNode,
                            depth: 2,
                            isCenter: false
                        });
                        
                        const linkId = `${sourceId}-${targetId}`;
                        links.set(linkId, {
                            source: sourceId,
                            target: targetId,
                            type: 'MemberOf',
                            isInfluence: false,
                            direction: 'out',
                            relationship: 'MemberOf'
                        });
                    }
                }
            }
        });
        
        // Tercera pasada: expandir canciones donde Sailor es lyricist
        const songsWithSailorAsLyricist = new Set();
        
        // Encontrar canciones donde Sailor es lyricist
        graphData.links.forEach(link => {
            if (link['Edge Type'] === 'LyricistOf') {
                const sourceId = typeof link.source === 'object' ? link.source.id : link.source;
                const targetId = typeof link.target === 'object' ? link.target.id : link.target;
                
                if (sourceId === sailorNode.id) {
                    songsWithSailorAsLyricist.add(targetId);
                }
            }
        });
        
        // Agregar otros lyricists y performers de esas canciones
        graphData.links.forEach(link => {
            if (link['Edge Type'] === 'LyricistOf' || link['Edge Type'] === 'PerformerOf' || 
                link['Edge Type'] === 'ProducerOf' || link['Edge Type'] === 'ComposerOf') {
                const sourceId = typeof link.source === 'object' ? link.source.id : link.source;
                const targetId = typeof link.target === 'object' ? link.target.id : link.target;
                
                // Si la canción está en nuestra lista y no es Sailor
                if (songsWithSailorAsLyricist.has(targetId) && sourceId !== sailorNode.id) {
                    const artistNode = graphData.nodes.find(n => n.id === sourceId);
                    
                    if (artistNode && artistNode['Node Type'] === 'Person' && !directConnections.has(sourceId) && !nodes.has(sourceId)) {
                        nodes.set(sourceId, {
                            ...artistNode,
                            depth: 2,
                            isCenter: false
                        });
                        
                        const linkId = `${sourceId}-${targetId}`;
                        links.set(linkId, {
                            source: sourceId,
                            target: targetId,
                            type: link['Edge Type'],
                            isInfluence: false,
                            direction: 'out',
                            relationship: link['Edge Type']
                        });
                    }
                }
            }
        });
    }
    
    return {
        nodes: Array.from(nodes.values()),
        links: Array.from(links.values())
    };
}

// ===== FUNCIÓN PARA DESCRIBIR RELACIONES =====
function getRelationshipDescription(edgeType, direction) {
    return edgeType;
}

// ===== CREACIÓN DE VISUALIZACIÓN =====
function createVisualization(data) {
    if (data.nodes.length === 0) {
        svg.append('text')
            .attr('x', '50%')
            .attr('y', '50%')
            .attr('text-anchor', 'middle')
            .attr('fill', '#ffffff')
            .text('No hay datos para mostrar');
        return;
    }
    
    // Crear grupo principal con zoom
    const g = svg.append('g');
    
    // Configurar zoom
    const zoom = d3.zoom()
        .scaleExtent([0.1, 4]) // Zoom desde 0.1x hasta 4x
        .on('zoom', (event) => {
            g.attr('transform', event.transform);
        });
    
    // Aplicar zoom al SVG
    svg.call(zoom);
    
    // Configurar simulación de fuerzas (más separación)
    simulation = d3.forceSimulation(data.nodes)
        .force('link', d3.forceLink(data.links).id(d => d.id).distance(d => {
            // Distancias adaptadas a la nueva distribución espacial
            const sourceType = d.source['Node Type'] || '';
            const targetType = d.target['Node Type'] || '';
            
            // Conexiones con Sailor Shift (centro)
            if (d.source.isCenter || d.target.isCenter) {
                // Distancias específicas según el tipo de nodo
                const otherNodeType = d.source.isCenter ? targetType : sourceType;
                
                switch(otherNodeType) {
                    case 'Person': return 360; // Artistas arriba (mayor distancia por posición más elevada)
                    case 'Song': return 340; // Canciones abajo izquierda (mantener distancia)
                    case 'Album': return 340; // Álbumes abajo derecha (mantener distancia)
                    case 'MusicalGroup': return 250; // Grupos a los lados
                    case 'RecordLabel': return 250; // Discográficas a los lados
                    default: return 180; // Otros
                }
            }
            
            // Conexiones entre nodos del mismo tipo (más cortas)
            if (sourceType === targetType) {
                return 60; // Mantienen cercanía entre elementos del mismo tipo
            }
            
            // Conexiones entre tipos diferentes
            return 120; // Distancia moderada
        }))
        .force('charge', d3.forceManyBody().strength(d => {
            // Más repulsión para grupos musicales
            if (d['Node Type'] === 'MusicalGroup') {
                return -600; // Aumentado para separarlos más
            }
            // Repulsión moderada para miembros de grupos
            if (d.depth === 2) {
                return -400; // Aumentado para separar artistas más
            }
            return CONFIG.forces.chargeStrength; // Repulsión normal
        }))
        .force('center', d3.forceCenter(svg.node().clientWidth / 2, svg.node().clientHeight / 2))
        .force('collision', d3.forceCollide().radius(d => getNodeRadius(d) + 40))
        .force('y', d3.forceY().y(d => {
            const centerY = svg.node().clientHeight / 2;
            const verticalSpread = 300; // Mayor separación vertical para zonas más claras
            
            // Sailor Shift en el centro
            if (d.isCenter) return centerY;
            
            // Distribución clara por zonas bien definidas
            switch(d['Node Type']) {
                case 'Person':
                    // Artistas ARRIBA del centro (zona superior bien separada)
                    // Agregar variación adicional para mejor distribución vertical
                    const artistHash = d.name.split('').reduce((hash, char) => hash + char.charCodeAt(0), 0);
                    const artistVariation = (artistHash % 80) - 40; // Variación de ±40px
                    return centerY - verticalSpread - 50 + artistVariation; // Más arriba con variación
                    
                case 'Song':
                    // Canciones ABAJO del centro (zona inferior izquierda)
                    return centerY + verticalSpread;
                    
                case 'Album':
                    // Álbumes ABAJO del centro (zona inferior derecha)
                    return centerY + verticalSpread;
                    
                case 'MusicalGroup':
                case 'RecordLabel':
                    return centerY; // Grupos y discográficas en el centro vertical
                default:
                    return centerY; // Otros en el centro
            }
        }).strength(0.9)) // Fuerza muy fuerte para mantener zonas bien definidas
        .force('x', d3.forceX().x(d => {
            const centerX = svg.node().clientWidth / 2;
            const horizontalSpread = 280; // Distancia horizontal desde el centro
            const maxWidth = svg.node().clientWidth * 0.9; // 90% del ancho para distribución amplia
            
            // Sailor Shift en el centro
            if (d.isCenter) return centerX;
            
            // Distribución clara por zonas horizontales
            switch(d['Node Type']) {
                case 'Person':
                    // Artistas distribuidos horizontalmente ARRIBA del centro
                    // Distribución más compacta y organizada en zona superior
                    const artistHash = d.name.split('').reduce((hash, char) => hash + char.charCodeAt(0), 0);
                    const artistSpread = (artistHash % 600) - 300; // Distribución en 600px de ancho centrado
                    return centerX + artistSpread; // Distribución centrada más compacta
                    
                case 'Song':
                    // Canciones en ZONA INFERIOR IZQUIERDA
                    const songHash = d.name.split('').reduce((hash, char) => hash + char.charCodeAt(0), 0);
                    const songSpread = (songHash % 300) - 150; // Distribución en 300px de ancho
                    const songOffset = -250; // Desplazamiento base hacia la izquierda
                    return centerX + songOffset + songSpread;
                    
                case 'Album':
                    // Álbumes en ZONA INFERIOR DERECHA
                    const albumHash = d.name.split('').reduce((hash, char) => hash + char.charCodeAt(0), 0);
                    const albumSpread = (albumHash % 300) - 150; // Distribución en 300px de ancho
                    const albumOffset = 250; // Desplazamiento base hacia la derecha
                    return centerX + albumOffset + albumSpread;
                    
                case 'MusicalGroup':
                    return centerX - horizontalSpread; // Grupos a la izquierda del centro
                    
                case 'RecordLabel':
                    return centerX + horizontalSpread; // Discográficas a la derecha del centro
                    
                default:
                    return centerX; // Otros en el centro
            }
        }).strength(0.7)) // Fuerza fuerte para mantener zonas bien separadas
        .alphaDecay(0.1)
        .velocityDecay(0.4);
    
    // Crear enlaces
    allLinks = g.append('g')
        .selectAll('line')
        .data(data.links)
        .enter()
        .append('line')
        .attr('class', d => `link ${d.isInfluence ? 'influence' : ''}`)
        .attr('stroke', '#666')
        .attr('stroke-width', 1)
        .attr('stroke-opacity', 0.6);
    
    // Crear nodos
    allNodes = g.append('g')
        .selectAll('circle')
        .data(data.nodes)
        .enter()
        .append('circle')
        .attr('class', 'node')
        .attr('r', d => getNodeRadius(d))
        .attr('fill', d => getNodeColor(d))
        .attr('stroke', d => d.isCenter ? '#ffffff' : 'none')
        .attr('stroke-width', d => d.isCenter ? 6 : 0)
        .on('mouseover', showTooltip)
        .on('mouseout', hideTooltip)
        .on('click', handleNodeClick)
        .call(d3.drag()
            .on('start', dragstarted)
            .on('drag', dragged)
            .on('end', dragended));
    
    // Crear etiquetas para nodos importantes
    allLabels = g.append('g')
        .selectAll('text')
        .data(data.nodes.filter(d => d.depth === 0 || d.notable || d['Node Type'] === 'Person' || d['Node Type'] === 'MusicalGroup'))
        .enter()
        .append('text')
        .attr('class', 'label')
        .attr('text-anchor', 'middle')
        .attr('dy', '.35em')
        .text(d => {
            // Para nombres largos, truncar y agregar "..."
            if (d.name.length > 20) {
                return d.name.substring(0, 20) + '...';
            }
            return d.name;
        });
    
    // Click en el fondo para deseleccionar
    svg.on('click', function(event) {
        if (event.target === this) {
            clearHighlight();
        }
    });
    
    // Actualizar posiciones
    simulation.on('tick', () => {
        allLinks
            .attr('x1', d => d.source.x)
            .attr('y1', d => d.source.y)
            .attr('x2', d => d.target.x)
            .attr('y2', d => d.target.y);
        
        allNodes
            .attr('cx', d => d.x)
            .attr('cy', d => d.y);
        
        allLabels
            .attr('x', d => d.x)
            .attr('y', d => d.y + 20);
    });
    
    // Centrar en Sailor Shift después de que la simulación se estabilice
    simulation.on('end', () => {
        const sailorNode = data.nodes.find(n => n.isCenter);
        if (sailorNode) {
            const transform = d3.zoomIdentity
                .translate(svg.node().clientWidth / 2 - sailorNode.x, svg.node().clientHeight / 2 - sailorNode.y)
                .scale(1);
            svg.transition().duration(750).call(zoom.transform, transform);
        }
    });
}

// ===== FUNCIONES AUXILIARES =====
function getNodeRadius(d) {
    if (d.isCenter) {
        // Tamaño dinámico según la vista
        if (currentView === 'collaborations') return 40; // Tamaño moderado en colaboraciones
        if (currentView === 'influences') return 35; // Tamaño estándar en influencias
        return CONFIG.nodeSizes.center;
    }
    if (d.notable) return CONFIG.nodeSizes.notable;  // Obras exitosas (mediano)
    return CONFIG.nodeSizes.normal;                  // Nodos normales (pequeño)
}

function getNodeColor(d) {
    const nodeType = d['Node Type'].toLowerCase();
    return CONFIG.colors[nodeType] || '#999';
}

function showTooltip(event, d) {
    const tooltip = document.getElementById('tooltip');
    let sizeInfo = '';
    
    if (d.isCenter) {
        sizeInfo = ' (Nodo central)';
    } else if (d.notable) {
        sizeInfo = ' (Notable)';
    }
    
    // Buscar relaciones para este nodo
    const relationships = [];
    if (!d.isCenter) {
        const sailorNode = graphData.nodes.find(n => n.name === "Sailor Shift");
        if (sailorNode) {
            graphData.links.forEach(link => {
                const sourceId = typeof link.source === 'object' ? link.source.id : link.source;
                const targetId = typeof link.target === 'object' ? link.target.id : link.target;
                
                if ((sourceId === sailorNode.id && targetId === d.id) || 
                    (sourceId === d.id && targetId === sailorNode.id)) {
                    relationships.push(link['Edge Type']);
                }
            });
        }
    }
    
    let tooltipContent = `
        <strong>${d.name}</strong><br>
        Tipo: ${d['Node Type']}${sizeInfo}<br>
        ${d.genre ? `Género: ${d.genre}<br>` : ''}
        ${d.notable ? '⭐ Obra exitosa<br>' : ''}
    `;
    
    if (relationships.length > 0) {
        tooltipContent += `<br><strong>Relación:</strong><br>`;
        relationships.forEach(rel => {
            tooltipContent += `• ${rel}<br>`;
        });
    }
    
    tooltip.innerHTML = tooltipContent;
    tooltip.style.display = 'block';
    tooltip.style.left = event.pageX + 10 + 'px';
    tooltip.style.top = event.pageY - 10 + 'px';
}

function hideTooltip() {
    document.getElementById('tooltip').style.display = 'none';
}

function handleNodeClick(event, d) {
    event.stopPropagation(); // Evitar que se propague al SVG
    
    if (selectedNode === d) {
        clearHighlight();
        selectedNode = null;
    } else {
        highlightNode(d);
        selectedNode = d;
    }
}

function highlightNode(d) {
    // Encontrar nodos conectados y caminos completos hasta Sailor Shift
    const connectedNodes = new Set([d.id]);
    const connectedLinks = new Set();
    const intermediateNodes = new Set(); // Nodos intermedios en el camino a Sailor
    
    // Buscar el nodo de Sailor Shift
    const sailorNode = allNodes.data().find(node => node.isCenter);
    
    // Si el nodo seleccionado NO es Sailor Shift, siempre incluir a Sailor
    if (!d.isCenter && sailorNode) {
        connectedNodes.add(sailorNode.id);
    }
    
    // PASO 1: Encontrar conexiones directas del nodo seleccionado
    allLinks.each(function(link) {
        const sourceId = typeof link.source === 'object' ? link.source.id : link.source;
        const targetId = typeof link.target === 'object' ? link.target.id : link.target;
        
        // Conexiones directas del nodo seleccionado
        if (sourceId === d.id || targetId === d.id) {
            connectedNodes.add(sourceId);
            connectedNodes.add(targetId);
            connectedLinks.add(`${sourceId}-${targetId}`);
            
            // El nodo del otro extremo es un nodo intermedio
            const intermediateNodeId = sourceId === d.id ? targetId : sourceId;
            if (intermediateNodeId !== sailorNode?.id) {
                intermediateNodes.add(intermediateNodeId);
            }
        }
    });
    
    // PASO 2: Para cada nodo intermedio, encontrar sus conexiones con Sailor Shift
    if (!d.isCenter && sailorNode) {
        intermediateNodes.forEach(intermediateId => {
            allLinks.each(function(link) {
                const sourceId = typeof link.source === 'object' ? link.source.id : link.source;
                const targetId = typeof link.target === 'object' ? link.target.id : link.target;
                
                // Conexiones entre nodo intermedio y Sailor Shift
                if ((sourceId === intermediateId && targetId === sailorNode.id) || 
                    (sourceId === sailorNode.id && targetId === intermediateId)) {
                    connectedLinks.add(`${sourceId}-${targetId}`);
                }
            });
        });
    }
    
    // Aplicar estilos de highlighting
    allNodes
        .attr('opacity', node => connectedNodes.has(node.id) ? 1.0 : 0.2)
        .attr('stroke', node => {
            if (node.id === d.id) return '#ffd700'; // Nodo seleccionado en dorado
            if (node.isCenter && !d.isCenter) return '#00ff88'; // Sailor en verde si no es el seleccionado
            if (node.isCenter) return '#ffffff'; // Sailor normal cuando es el seleccionado
            return 'none';
        })
        .attr('stroke-width', node => {
            if (node.id === d.id) return 6; // Nodo seleccionado más grueso
            if (node.isCenter && !d.isCenter) return 6; // Sailor destacado si no es el seleccionado
            if (node.isCenter) return 6; // Sailor normal (corregido)
            return 0;
        });
    
    allLinks
        .attr('opacity', link => {
            const sourceId = typeof link.source === 'object' ? link.source.id : link.source;
            const targetId = typeof link.target === 'object' ? link.target.id : link.target;
            const linkId = `${sourceId}-${targetId}`;
            return connectedLinks.has(linkId) ? 0.8 : 0.1;
        })
        .attr('stroke', link => {
            const sourceId = typeof link.source === 'object' ? link.source.id : link.source;
            const targetId = typeof link.target === 'object' ? link.target.id : link.target;
            const linkId = `${sourceId}-${targetId}`;
            
            // Color especial para conexiones con Sailor cuando NO es Sailor el seleccionado
            if (!d.isCenter && sailorNode && 
                ((sourceId === d.id && targetId === sailorNode.id) || 
                 (sourceId === sailorNode.id && targetId === d.id))) {
                return '#00ff88'; // Verde para conexión con Sailor
            }
            
            return connectedLinks.has(linkId) ? '#ffd700' : '#666';
        })
        .attr('stroke-width', link => {
            const sourceId = typeof link.source === 'object' ? link.source.id : link.source;
            const targetId = typeof link.target === 'object' ? link.target.id : link.target;
            const linkId = `${sourceId}-${targetId}`;
            return connectedLinks.has(linkId) ? 2 : 1;
        });
    
    allLabels
        .attr('opacity', label => connectedNodes.has(label.id) ? 1.0 : 0.3)
        .attr('fill', label => {
            if (label.id === d.id) return '#ffd700'; // Nodo seleccionado en dorado
            if (label.isCenter && !d.isCenter) return '#00ff88'; // Sailor en verde
            return '#ffffff';
        });
}

function clearHighlight() {
    // Resetear todos los estilos
    allNodes
        .attr('opacity', 1.0)
        .attr('stroke', node => node.isCenter ? '#ffffff' : 'none')
        .attr('stroke-width', node => node.isCenter ? 6 : 0);
    
    allLinks
        .attr('opacity', 0.6)
        .attr('stroke', '#666')
        .attr('stroke-width', 1);
    
    allLabels
        .attr('opacity', 1.0)
        .attr('fill', '#ffffff');
    
    selectedNode = null;
    
    // Desactivar highlight de artistas si está activo
    if (artistHighlightActive) {
        artistHighlightActive = false;
        const btn = document.getElementById('highlight-artists-btn');
        if (btn) btn.classList.remove('active');
    }
}

// ===== HIGHLIGHT DE COLABORACIONES CON ARTISTAS =====
function toggleArtistHighlight() {
    const btn = document.getElementById('highlight-artists-btn');
    
    // Solo funcionar en la vista de colaboraciones
    if (currentView !== 'collaborations') {
        alert('⚠️ Esta función solo está disponible en la vista de "Colaboraciones".\n\nCambia a la vista de Colaboraciones para resaltar las conexiones con artistas.');
        return;
    }
    
    if (artistHighlightActive) {
        // Desactivar highlight
        clearHighlight();
        artistHighlightActive = false;
        btn.classList.remove('active');
    } else {
        // Activar highlight
        highlightArtistCollaborations();
        artistHighlightActive = true;
        btn.classList.add('active');
    }
}

function highlightArtistCollaborations() {
    // Solo funcionar en la vista de colaboraciones
    if (currentView !== 'collaborations') {
        console.log('Esta función solo está disponible en la vista de Colaboraciones');
        return;
    }
    
    // Buscar el nodo de Sailor Shift
    const sailorNode = allNodes.data().find(node => node.isCenter);
    if (!sailorNode) return;
    
    // Definir tipos de conexión de colaboración (mismo que en processNetworkData)
    const collaborationTypes = ['PerformerOf', 'ComposerOf', 'ProducerOf', 'LyricistOf', 'MemberOf'];
    
    // Usar la misma lógica que highlightNode() pero solo para artistas con colaboraciones
    const connectedNodes = new Set([sailorNode.id]);
    const connectedLinks = new Set();
    const intermediateNodes = new Set(); // Artistas conectados
    
    // PASO 1: Encontrar conexiones directas de colaboración entre Sailor Shift y artistas
    allLinks.each(function(link) {
        const sourceId = typeof link.source === 'object' ? link.source.id : link.source;
        const targetId = typeof link.target === 'object' ? link.target.id : link.target;
        
        // Verificar que el enlace sea de colaboración
        if (collaborationTypes.includes(link.type)) {
            // Conexiones directas del Sailor Shift
            if (sourceId === sailorNode.id || targetId === sailorNode.id) {
                const otherId = sourceId === sailorNode.id ? targetId : sourceId;
                const otherNode = allNodes.data().find(n => n.id === otherId);
                
                // Solo incluir si es un artista (Person)
                if (otherNode && otherNode['Node Type'] === 'Person') {
                    connectedNodes.add(otherId);
                    connectedLinks.add(`${sourceId}-${targetId}`);
                    
                    // El artista es un nodo conectado
                    intermediateNodes.add(otherId);
                }
            }
        }
    });
    
    // PASO 2: Para cada artista conectado, encontrar sus conexiones indirectas con Sailor Shift (a través de canciones, etc.)
    intermediateNodes.forEach(artistId => {
        allLinks.each(function(link) {
            const sourceId = typeof link.source === 'object' ? link.source.id : link.source;
            const targetId = typeof link.target === 'object' ? link.target.id : link.target;
            
            // Buscar rutas indirectas entre el artista y Sailor Shift
            if ((sourceId === artistId && targetId === sailorNode.id) || 
                (sourceId === sailorNode.id && targetId === artistId)) {
                connectedLinks.add(`${sourceId}-${targetId}`);
            }
        });
    });
    
    // Aplicar los mismos estilos que highlightNode() pero solo para artistas
    allNodes
        .attr('opacity', node => connectedNodes.has(node.id) ? 1.0 : 0.2)
        .attr('stroke', node => {
            if (node.isCenter) return '#00ff88'; // Sailor en verde (mismo color que highlightNode)
            if (intermediateNodes.has(node.id)) return '#ffd700'; // Artistas en dorado (mismo color que highlightNode)
            return 'none';
        })
        .attr('stroke-width', node => {
            if (node.isCenter) return 6; // Sailor destacado
            if (intermediateNodes.has(node.id)) return 6; // Artistas destacados
            return 0;
        });
    
    allLinks
        .attr('opacity', link => {
            const sourceId = typeof link.source === 'object' ? link.source.id : link.source;
            const targetId = typeof link.target === 'object' ? link.target.id : link.target;
            const linkId = `${sourceId}-${targetId}`;
            return connectedLinks.has(linkId) ? 0.8 : 0.1;
        })
        .attr('stroke', link => {
            const sourceId = typeof link.source === 'object' ? link.source.id : link.source;
            const targetId = typeof link.target === 'object' ? link.target.id : link.target;
            const linkId = `${sourceId}-${targetId}`;
            return connectedLinks.has(linkId) ? '#00ff88' : '#666'; // Verde para conexiones con artistas
        })
        .attr('stroke-width', link => {
            const sourceId = typeof link.source === 'object' ? link.source.id : link.source;
            const targetId = typeof link.target === 'object' ? link.target.id : link.target;
            const linkId = `${sourceId}-${targetId}`;
            return connectedLinks.has(linkId) ? 2 : 1;
        });
    
    allLabels
        .attr('opacity', label => connectedNodes.has(label.id) ? 1.0 : 0.3)
        .attr('fill', label => {
            if (label.isCenter) return '#00ff88'; // Sailor en verde
            if (intermediateNodes.has(label.id)) return '#ffd700'; // Artistas en dorado
            return '#ffffff';
        });
    
    // Establecer que Sailor Shift está seleccionado (para consistencia con highlightNode)
    selectedNode = sailorNode;
}

function dragstarted(event, d) {
    if (!event.active) simulation.alphaTarget(0.3).restart();
    d.fx = d.x;
    d.fy = d.y;
}

function dragged(event, d) {
    d.fx = event.x;
    d.fy = event.y;
}

function dragended(event, d) {
    if (!event.active) simulation.alphaTarget(0);
    d.fx = null;
    d.fy = null;
}

// ===== LIMPIEZA =====
window.addEventListener('beforeunload', () => {
    if (simulation) simulation.stop();
}); 