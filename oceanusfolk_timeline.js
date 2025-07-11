// Oceanus Folk Influence Timeline
// This script draws a timeline/area chart below the Sankey showing the number of outward influences from Oceanus Folk per year.

async function drawOceanusFolkTimeline() {
    // Add a new SVG below the Sankey
    let timelineDiv = document.getElementById('oceanusfolk-timeline');
    if (!timelineDiv) {
        timelineDiv = document.createElement('div');
        timelineDiv.id = 'oceanusfolk-timeline';
        timelineDiv.style.width = '100%';
        timelineDiv.style.height = '220px';
        timelineDiv.style.background = 'rgba(0,0,0,0.1)';
        timelineDiv.style.marginTop = '0px';
        document.getElementById('visualization').appendChild(timelineDiv);
    } else {
        timelineDiv.innerHTML = '';
    }
    const width = document.getElementById('visualization').clientWidth - 40;
    const height = 200;
    const margin = { left: 60, right: 30, top: 30, bottom: 40 };
    const svg = d3.select('#oceanusfolk-timeline')
        .append('svg')
        .attr('width', width)
        .attr('height', height + margin.top + margin.bottom);

    // Load data
    const [graphData, songsData] = await Promise.all([
        d3.json('MC1_graph.json'),
        d3.csv('songs_albums_analysis.csv')
    ]);

    // Build genre lookup
    const genreLookup = {};
    songsData.forEach(d => {
        if (d.id && d.genre) genreLookup[String(d.id).trim()] = d.genre;
    });
    // Helper: get genre for a node
    function getGenre(node) {
        if (node['Node Type'] === 'Song' || node['Node Type'] === 'Album') {
            const genre = genreLookup[String(node.id).trim()];
            if (genre && genre !== 'Unknown') return genre;
        }
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
    // Build Song/Album node map
    const nodes = new Map();
    graphData.nodes.forEach(n => {
        if (n['Node Type'] === 'Song' || n['Node Type'] === 'Album') {
            nodes.set(n.id, { ...n, genre: getGenre(n) });
        }
    });
    // Find all outward influences from Oceanus Folk
    const yearCounts = {};
    graphData.links.forEach(link => {
        const source = nodes.get(link.source);
        const target = nodes.get(link.target);
        if (!source || !target) return;
        if (getGenre(source) === 'Oceanus Folk' && getGenre(target) !== 'Oceanus Folk') {
            const year = getYear(source);
            if (year) yearCounts[year] = (yearCounts[year] || 0) + 1;
        }
    });
    // Convert to sorted array
    const data = Object.entries(yearCounts).map(([year, count]) => ({ year: +year, count })).sort((a,b) => a.year - b.year);
    if (data.length === 0) {
        svg.append('text')
            .attr('x', width/2)
            .attr('y', height/2)
            .attr('text-anchor', 'middle')
            .attr('fill', '#fff')
            .text('No Oceanus Folk outward influences found.');
        return;
    }
    // X/Y scales
    const x = d3.scaleLinear()
        .domain([d3.min(data, d => d.year), d3.max(data, d => d.year)])
        .range([margin.left, width - margin.right]);
    const y = d3.scaleLinear()
        .domain([0, d3.max(data, d => d.count)]).nice()
        .range([height, margin.top]);
    // Area generator
    const area = d3.area()
        .x(d => x(d.year))
        .y0(y(0))
        .y1(d => y(d.count))
        .curve(d3.curveMonotoneX);
    // Draw area
    svg.append('path')
        .datum(data)
        .attr('fill', '#45b7d1')
        .attr('opacity', 0.5)
        .attr('d', area);
    // Draw line
    svg.append('path')
        .datum(data)
        .attr('fill', 'none')
        .attr('stroke', '#45b7d1')
        .attr('stroke-width', 2)
        .attr('d', d3.line()
            .x(d => x(d.year))
            .y(d => y(d.count))
            .curve(d3.curveMonotoneX)
        );
    // Axes
    svg.append('g')
        .attr('transform', `translate(0,${height})`)
        .call(d3.axisBottom(x).tickFormat(d3.format('d')))
        .selectAll('text').attr('fill', '#fff');
    svg.append('g')
        .attr('transform', `translate(${margin.left},0)`)
        .call(d3.axisLeft(y))
        .selectAll('text').attr('fill', '#fff');
    // Labels
    svg.append('text')
        .attr('x', width/2)
        .attr('y', margin.top-10)
        .attr('text-anchor', 'middle')
        .attr('fill', '#fff')
        .attr('font-size', 16)
        .text('Oceanus Folk Outward Influences per Year');
    svg.append('text')
        .attr('x', width/2)
        .attr('y', height + margin.bottom - 5)
        .attr('text-anchor', 'middle')
        .attr('fill', '#fff')
        .attr('font-size', 12)
        .text('Year');
    svg.append('text')
        .attr('transform', `rotate(-90)`)
        .attr('x', -height/2)
        .attr('y', 18)
        .attr('text-anchor', 'middle')
        .attr('fill', '#fff')
        .attr('font-size', 12)
        .text('Number of Outward Influences');

    // --- Inward Influence Timeline ---
    // Find all inward influences to Oceanus Folk
    const inwardYearCounts = {};
    graphData.links.forEach(link => {
        const source = nodes.get(link.source);
        const target = nodes.get(link.target);
        if (!source || !target) return;
        if (getGenre(target) === 'Oceanus Folk' && getGenre(source) !== 'Oceanus Folk') {
            const year = getYear(target);
            if (year) inwardYearCounts[year] = (inwardYearCounts[year] || 0) + 1;
        }
    });
    // Convert to sorted array
    const inwardData = Object.entries(inwardYearCounts).map(([year, count]) => ({ year: +year, count })).sort((a,b) => a.year - b.year);
    // Add a new SVG for inward chart
    let inwardDiv = document.getElementById('oceanusfolk-timeline-inward');
    if (!inwardDiv) {
        inwardDiv = document.createElement('div');
        inwardDiv.id = 'oceanusfolk-timeline-inward';
        inwardDiv.style.width = '100%';
        inwardDiv.style.height = '220px';
        inwardDiv.style.background = 'rgba(0,0,0,0.1)';
        inwardDiv.style.marginTop = '10px';
        document.getElementById('visualization').appendChild(inwardDiv);
    } else {
        inwardDiv.innerHTML = '';
    }
    const svgIn = d3.select('#oceanusfolk-timeline-inward')
        .append('svg')
        .attr('width', width)
        .attr('height', height + margin.top + margin.bottom);
    if (inwardData.length === 0) {
        svgIn.append('text')
            .attr('x', width/2)
            .attr('y', height/2)
            .attr('text-anchor', 'middle')
            .attr('fill', '#fff')
            .text('No Oceanus Folk inward influences found.');
        return;
    }
    // X/Y scales (reuse x, y)
    const yIn = d3.scaleLinear()
        .domain([0, d3.max(inwardData, d => d.count)]).nice()
        .range([height, margin.top]);
    // Area generator
    const areaIn = d3.area()
        .x(d => x(d.year))
        .y0(yIn(0))
        .y1(d => yIn(d.count))
        .curve(d3.curveMonotoneX);
    // Draw area
    svgIn.append('path')
        .datum(inwardData)
        .attr('fill', '#ff6b35')
        .attr('opacity', 0.5)
        .attr('d', areaIn);
    // Draw line
    svgIn.append('path')
        .datum(inwardData)
        .attr('fill', 'none')
        .attr('stroke', '#ff6b35')
        .attr('stroke-width', 2)
        .attr('d', d3.line()
            .x(d => x(d.year))
            .y(d => yIn(d.count))
            .curve(d3.curveMonotoneX)
        );
    // Axes
    svgIn.append('g')
        .attr('transform', `translate(0,${height})`)
        .call(d3.axisBottom(x).tickFormat(d3.format('d')))
        .selectAll('text').attr('fill', '#fff');
    svgIn.append('g')
        .attr('transform', `translate(${margin.left},0)`)
        .call(d3.axisLeft(yIn))
        .selectAll('text').attr('fill', '#fff');
    // Labels
    svgIn.append('text')
        .attr('x', width/2)
        .attr('y', margin.top-10)
        .attr('text-anchor', 'middle')
        .attr('fill', '#fff')
        .attr('font-size', 16)
        .text('Oceanus Folk Inward Influences per Year');
    svgIn.append('text')
        .attr('x', width/2)
        .attr('y', height + margin.bottom - 5)
        .attr('text-anchor', 'middle')
        .attr('fill', '#fff')
        .attr('font-size', 12)
        .text('Year');
    svgIn.append('text')
        .attr('transform', `rotate(-90)`)
        .attr('x', -height/2)
        .attr('y', 18)
        .attr('text-anchor', 'middle')
        .attr('fill', '#fff')
        .attr('font-size', 12)
        .text('Number of Inward Influences');
}

// Draw on load
window.addEventListener('load', drawOceanusFolkTimeline); 