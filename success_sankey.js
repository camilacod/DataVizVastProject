const config = {
    width: 0,
    height: 0,
    margin: { top: 20, right: 20, bottom: 20, left: 20 },
    colors: {
        oceanus: '#45b7d1',
        genre: '#ff6b35',
        artist: '#ffd700'
    },
    sankeyPadding: 15,
    nodeWidth: 20
};
let svg, sankey, tooltip, originalData, processedData;
let activeFilters = {
    timePeriod: 'all',
    minFlowStrength: 2,
    showPercentages: false
};
// Add Sailor Shift era filter logic
let currentEra = 'all';
let originalGraphData = null;
let originalSongsData = null;

async function init() {
    try {
        const container = document.getElementById('visualization');
        config.width = container.clientWidth - config.margin.left - config.margin.right;
        config.height = container.clientHeight - config.margin.top - config.margin.bottom;
        const graphData = await d3.json('MC1_graph.json');
        const songsData = await d3.csv('songs_albums_analysis.csv');
        originalGraphData = graphData;
        originalSongsData = songsData;
        await processInfluenceSpreadData(graphData, songsData);
        setupSVG();
        createSankeyDiagram();
        setupControls();
        document.getElementById('loading').style.display = 'none';
    } catch (error) {
        console.error('Error in init:', error);
        document.getElementById('loading').innerHTML = '<div>Error loading data. Please check the console.</div>';
    }
}

function getEraFilter(year) {
    if (!year) return false;
    if (currentEra === 'pre') return year <= 2023;
    if (currentEra === 'mid') return year > 2022 && year <= 2030;
    if (currentEra === 'peak') return year > 2030 && year <= 2039;
    return true; // 'all'
}

async function processInfluenceSpreadData(graphData, songsData) {
    console.log('[Sankey] processInfluenceSpreadData called. Era:', currentEra, 'Links:', graphData.links.length);
    // Build robust genre lookup from CSV (string match, trim whitespace)
    const genreLookup = {};
    songsData.forEach(d => {
        if (d.id && d.genre) genreLookup[String(d.id).trim()] = d.genre;
    });
    graphData.nodes.forEach(n => {
        if (n.id && n.genre) genreLookup[String(n.id).trim()] = n.genre;
    });

    // Helper: get genre for a node
    function getGenre(node) {
        // For Song/Album, always use CSV genre if available
        if (node['Node Type'] === 'Song' || node['Node Type'] === 'Album') {
            const genre = genreLookup[String(node.id).trim()];
            if (genre && genre !== 'Unknown') return genre;
        }
        // Otherwise, use node genre if available
        if (node.genre && node.genre !== 'Unknown') return node.genre;
        if (genreLookup[String(node.id).trim()] && genreLookup[String(node.id).trim()] !== 'Unknown') return genreLookup[String(node.id).trim()];
        return 'Unknown';
    }

    // Helper: get release year
    function getYear(node) {
        let y = node.release_date || node.release_year;
        if (!y && node.id && songsData) {
            const d = songsData.find(row => String(row.id).trim() === String(node.id).trim());
            if (d && d.release_date) y = d.release_date;
        }
        if (y) return parseInt(y);
        return null;
    }

    // DEBUG: Track unknown genres (for Song/Album only)
    let unknownCount = 0;
    let totalNodes = graphData.nodes.filter(n => n['Node Type'] === 'Song' || n['Node Type'] === 'Album').length;
    graphData.nodes.forEach(n => {
        if (n['Node Type'] !== 'Song' && n['Node Type'] !== 'Album') return;
        const genre = getGenre(n);
        if (genre === 'Unknown') {
            unknownCount++;
            console.log('[DEBUG] Unknown genre:', {
                id: n.id,
                name: n.name,
                type: n['Node Type'],
                nodeGenre: n.genre,
                csvGenre: genreLookup[String(n.id).trim()]
            });
        }
    });
    console.log(`[DEBUG] Total Song/Album nodes: ${totalNodes}, Unknown genre count: ${unknownCount}, Percent unknown: ${(unknownCount/totalNodes*100).toFixed(2)}%`);

    // Identify Oceanus Folk nodes (Song/Album only)
    const isOceanusFolk = n => (n['Node Type'] === 'Song' || n['Node Type'] === 'Album') && getGenre(n) === 'Oceanus Folk';
    const nodes = new Map();
    graphData.nodes.forEach(n => {
        if (n['Node Type'] === 'Song' || n['Node Type'] === 'Album') {
            nodes.set(n.id, { ...n, genre: getGenre(n) });
        }
    });

    // Collect all links where Oceanus Folk Song/Album is source or target, and both source/target are Song/Album
    const inward = []; // Other genre -> Oceanus Folk
    const outward = []; // Oceanus Folk -> Other genre
    graphData.links.forEach(link => {
        const source = nodes.get(link.source);
        const target = nodes.get(link.target);
        if (!source || !target) return;
        // Apply era filter: for inward, use target year; for outward, use source year
        if (isOceanusFolk(target) && !isOceanusFolk(source)) {
            const year = getYear(target);
            if (getEraFilter(year)) {
                inward.push({
                    from: source,
                    to: target,
                    type: link['Edge Type']
                });
            }
        } else if (isOceanusFolk(source) && !isOceanusFolk(target)) {
            const year = getYear(source);
            if (getEraFilter(year)) {
                outward.push({
                    from: source,
                    to: target,
                    type: link['Edge Type']
                });
            }
        }
    });

    // Aggregate inward by source genre
    const inwardAgg = {};
    inward.forEach(l => {
        const genre = l.from.genre || 'Unknown';
        inwardAgg[genre] = (inwardAgg[genre] || 0) + 1;
    });
    // Aggregate outward by target genre
    const outwardGenreAgg = {};
    outward.forEach(l => {
        const genre = l.to.genre || 'Unknown';
        outwardGenreAgg[genre] = (outwardGenreAgg[genre] || 0) + 1;
    });

    // Build Sankey nodes
    const sankeyNodes = [];
    const nodeIndex = new Map();
    // Left: Inward genres
    Object.keys(inwardAgg).forEach(genre => {
        sankeyNodes.push({ id: `inward_${genre}`, name: genre, category: 'genre', color: config.colors.genre });
        nodeIndex.set(`inward_${genre}`, sankeyNodes.length - 1);
    });
    // Middle: Oceanus Folk
    sankeyNodes.push({ id: 'oceanusfolk', name: 'Oceanus Folk', category: 'oceanus', color: config.colors.oceanus });
    nodeIndex.set('oceanusfolk', sankeyNodes.length - 1);
    // Right: Outward genres (top 8)
    const topGenres = Object.entries(outwardGenreAgg).sort((a,b) => b[1]-a[1]).slice(0,8);
    topGenres.forEach(([genre]) => {
        sankeyNodes.push({ id: `outward_${genre}`, name: genre, category: 'genre', color: config.colors.genre });
        nodeIndex.set(`outward_${genre}`, sankeyNodes.length - 1);
    });

    // Build Sankey links
    const sankeyLinks = [];
    // Inward: genre -> Oceanus Folk
    Object.entries(inwardAgg).forEach(([genre, count]) => {
        if (count >= activeFilters.minFlowStrength) {
            sankeyLinks.push({
                source: nodeIndex.get(`inward_${genre}`),
                target: nodeIndex.get('oceanusfolk'),
                value: count,
                color: config.colors.genre
            });
        }
    });
    // Outward: Oceanus Folk -> genre
    topGenres.forEach(([genre, count]) => {
        if (count >= activeFilters.minFlowStrength) {
            sankeyLinks.push({
                source: nodeIndex.get('oceanusfolk'),
                target: nodeIndex.get(`outward_${genre}`),
                value: count,
                color: config.colors.oceanus
            });
        }
    });
    originalData = { sankeyNodes, sankeyLinks, inward, outward, inwardAgg, outwardGenreAgg };
    updateProcessedData();
}
function updateProcessedData() {
    processedData = {
        nodes: originalData.sankeyNodes,
        links: originalData.sankeyLinks
    };
    updateStats();
}
function setupSVG() {
    svg = d3.select('#sankey-svg')
        .attr('width', config.width + config.margin.left + config.margin.right)
        .attr('height', config.height + config.margin.top + config.margin.bottom);

    // Remove any existing <g>
    svg.selectAll('g').remove();

    const g = svg.append('g')
        .attr('transform', `translate(${config.margin.left}, ${config.margin.top})`);
    sankey = d3.sankey()
        .nodeWidth(config.nodeWidth)
        .nodePadding(config.sankeyPadding)
        .extent([[1, 1], [config.width - 1, config.height - 6]]);
    tooltip = d3.select('#tooltip');
}
function createSankeyDiagram() {
    if (!processedData || !processedData.nodes.length) return;
    const g = svg.select('g');
    if (!g.node()) return; // If the group doesn't exist, exit early
    g.selectAll('.node').remove();
    g.selectAll('.link').remove();
    const graph = sankey({
        nodes: processedData.nodes.map(d => ({ ...d })),
        links: processedData.links.map(d => ({ ...d }))
    });
    const defs = svg.select('defs').empty() ? svg.append('defs') : svg.select('defs');
    graph.links.forEach((link, i) => {
        const gradient = defs.append('linearGradient')
            .attr('id', `gradient-${i}`)
            .attr('gradientUnits', 'userSpaceOnUse')
            .attr('x1', link.source.x1)
            .attr('x2', link.target.x0);
        gradient.append('stop').attr('offset', '0%').attr('stop-color', link.source.color);
        gradient.append('stop').attr('offset', '100%').attr('stop-color', link.target.color);
    });
    svg.select('g').selectAll('.link')
        .data(graph.links)
        .enter().append('path')
        .attr('class', 'link')
        .attr('d', d3.sankeyLinkHorizontal())
        .style('stroke', (d, i) => `url(#gradient-${i})`)
        .style('stroke-width', d => Math.max(1, d.width))
        .style('fill', 'none')
        .on('mouseover', handleLinkMouseOver)
        .on('mouseout', handleMouseOut);
    const node = svg.select('g').selectAll('.node')
        .data(graph.nodes)
        .enter().append('g')
        .attr('class', 'node')
        .attr('transform', d => `translate(${d.x0}, ${d.y0})`);
    node.append('rect')
        .attr('height', d => d.y1 - d.y0)
        .attr('width', d => d.x1 - d.x0)
        .style('fill', d => d.color)
        .style('opacity', 0.8)
        .on('mouseover', handleNodeMouseOver)
        .on('mouseout', handleMouseOut);
    node.append('text')
        .attr('x', d => (d.x1 - d.x0) / 2)
        .attr('y', d => (d.y1 - d.y0) / 2)
        .attr('dy', '0.35em')
        .attr('text-anchor', 'middle')
        .style('fill', '#fff')
        .style('font-size', '10px')
        .style('font-weight', 'bold')
        .text(d => d.name.length > 16 ? d.name.substring(0, 16) + '...' : d.name);
    if (activeFilters.showPercentages) {
        svg.select('g').selectAll('.link-label')
            .data(graph.links.filter(d => d.width > 5))
            .enter().append('text')
            .attr('class', 'link-label')
            .attr('x', d => (d.source.x1 + d.target.x0) / 2)
            .attr('y', d => (d.y0 + d.y1) / 2)
            .attr('dy', '0.35em')
            .attr('text-anchor', 'middle')
            .style('fill', '#fff')
            .style('font-size', '9px')
            .text(d => `${d.value}`);
    }
}
function handleNodeMouseOver(event, d) {
    let details = [];
    if (d.category === 'oceanus') {
        details.push({ label: 'Type', value: 'Oceanus Folk (central)' });
    } else if (d.category === 'genre') {
        details.push({ label: 'Type', value: 'Genre' });
    } else if (d.category === 'artist') {
        details.push({ label: 'Type', value: 'Artist' });
    }
    showTooltip(event, {
        title: d.name,
        details
    });
    svg.selectAll('.link').style('opacity', link => link.source === d || link.target === d ? 1 : 0.3);
}
function handleLinkMouseOver(event, d) {
    showTooltip(event, {
        title: 'Influence Pathway',
        details: [
            { label: 'From', value: d.source.name },
            { label: 'To', value: d.target.name },
            { label: 'Flow Strength', value: d.value }
        ]
    });
    svg.selectAll('.link').style('opacity', link => link === d ? 1 : 0.3);
}
function handleMouseOut() {
    tooltip.style('display', 'none');
    svg.selectAll('.link').style('opacity', 0.7);
}
function showTooltip(event, data) {
    const html = `<h3>${data.title}</h3>${data.details.map(detail => `<div class="metric"><span class="label">${detail.label}:</span><span class="value">${detail.value}</span></div>`).join('')}`;
    tooltip.style('display', 'block')
        .style('left', (event.pageX + 15) + 'px')
        .style('top', (event.pageY + 10) + 'px')
        .html(html);
}
function setupControls() {
    // No controls to set up since the panel was removed
}
function updateStats() {
    if (!originalData) return;
    // a. Intermittent or gradual rise: show total inward/outward links
    const totalInward = Object.values(originalData.inwardAgg).reduce((a,b) => a+b, 0);
    const totalOutward = Object.values(originalData.outwardGenreAgg).reduce((a,b) => a+b, 0);
    // b. Top genres/artists influenced
    const topGenre = Object.entries(originalData.outwardGenreAgg).sort((a,b) => b[1]-a[1])[0]?.[0] || 'None';
    const sr = document.getElementById('successRate');
    if (sr) sr.textContent = `Inward: ${totalInward}, Outward: ${totalOutward}`;
    const at = document.getElementById('avgTimeToSuccess');
    if (at) at.textContent = `Top Out: ${topGenre}`;
    const tp = document.getElementById('topPathway');
    if (tp) tp.textContent = `Top In: ${topInwardGenre}`;
}
function exportPathways() {
    const data = {
        pathways: processedData,
        stats: {
            successRate: document.getElementById('successRate').textContent,
            avgTimeToSuccess: document.getElementById('avgTimeToSuccess').textContent,
            topPathway: document.getElementById('topPathway').textContent
        },
        timestamp: new Date().toISOString()
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'oceanusfolk_influence_spread.json';
    a.click();
    URL.revokeObjectURL(url);
}
function resetAnalysis() {
    document.getElementById('timePeriod').value = 'all';
    document.getElementById('minFlowStrength').value = '2';
    document.getElementById('flowStrengthValue').textContent = '2';
    document.getElementById('showPercentages').checked = false;
    activeFilters = { timePeriod: 'all', minFlowStrength: 2, showPercentages: false };
    updateProcessedData();
    createSankeyDiagram();
}
window.addEventListener('resize', function() {
    const container = document.getElementById('visualization');
    config.width = container.clientWidth - config.margin.left - config.margin.right;
    config.height = container.clientHeight - config.margin.top - config.margin.bottom;
    svg.attr('width', config.width + config.margin.left + config.margin.right)
       .attr('height', config.height + config.margin.top + config.margin.bottom);
    sankey.extent([[1, 1], [config.width - 1, config.height - 6]]);
    createSankeyDiagram();
});
if (typeof window !== 'undefined') {
    window.addEventListener('DOMContentLoaded', () => {
        const filter = document.getElementById('sailorshift-period-filter');
        if (filter) {
            filter.addEventListener('change', async function() {
                currentEra = this.value;
                console.log('[Sankey Filter] Era changed to:', currentEra);
                if (originalGraphData && originalSongsData) {
                    await processInfluenceSpreadData(originalGraphData, originalSongsData);
                    createSankeyDiagram();
                }
            });
        }
    });
}
window.addEventListener('load', init); 