Promise.all([
    d3.json('MC1_graph.json'),
    d3.csv('songs_albums_analysis.csv')
]).then(([graphData, songsData]) => {
    console.log('Data loaded successfully');
    console.log('Graph nodes:', graphData.nodes.length);
    console.log('Songs data:', songsData.length);
    
    // Process rising stars data
    const risingStarsData = processRisingStarsData(graphData, songsData);
    
    // Initialize visualizations
    initializeTrajectoryChart(risingStarsData.trajectories);
    initializeMetricsPanel(risingStarsData.metrics);
    initializePredictions(risingStarsData.predictions);
}).catch(error => {
    console.error('Error loading data:', error);
    document.getElementById('container').innerHTML = `
        <div style="color: red; padding: 20px;">
            Error loading data. Please check the console for details.
        </div>
    `;
});

function processRisingStarsData(graphData, songsData) {
    // Create lookup for songs data
    const songsLookup = new Map(songsData.map(d => [d.id, d]));

    // Precompute workCollaboratorsMap
    const workCollaboratorsMap = new Map();
    graphData.links.forEach(link => {
        if (["PerformerOf", "ComposerOf"].includes(link["Edge Type"])) {
            const sourceNode = graphData.nodes.find(n => n.id === link.source);
            const targetNode = graphData.nodes.find(n => n.id === link.target);
            if (!sourceNode || !targetNode) return;
            let workId, personId;
            if (sourceNode["Node Type"] === "Person") {
                personId = sourceNode.id;
                workId = targetNode.id;
            } else if (targetNode["Node Type"] === "Person") {
                personId = targetNode.id;
                workId = sourceNode.id;
            } else {
                return;
            }
            if (!workCollaboratorsMap.has(workId)) workCollaboratorsMap.set(workId, new Set());
            workCollaboratorsMap.get(workId).add(personId);
        }
    });
    // Precompute nodeById
    const nodeById = new Map(graphData.nodes.map(n => [n.id, n]));

    // Find potential rising stars
    const risingStars = findRisingStars(graphData, songsData, songsLookup, workCollaboratorsMap, nodeById);

    // Use the top 3 emerging artists by score for trajectories and metrics
    const topArtists = risingStars.slice(0, 3).map(star => star.name);
    const artistMetrics = new Map();
    topArtists.forEach(artist => {
        const metrics = processArtistMetrics(artist, graphData, songsData, songsLookup);
        if (metrics) {
            artistMetrics.set(artist, metrics);
        }
    });

    return {
        trajectories: Array.from(artistMetrics.entries())
            .filter(([_, metrics]) => metrics !== null)
            .map(([artist, metrics]) => ({
                artist,
                ...metrics
            })),
        metrics: {
            averageTimeToSuccess: calculateAverageTimeToSuccess(artistMetrics),
            keyCollaborations: findKeyCollaborations(artistMetrics, graphData),
            genreVersatility: calculateGenreVersatility(artistMetrics)
        },
        predictions: risingStars
    };
}

function processArtistMetrics(artistName, graphData, songsData, songsLookup) {
    const artistNode = graphData.nodes.find(n => n.name === artistName);
    if (!artistNode) return null;

    const works = new Set();
    const collaborators = new Set();
    const genres = new Set();
    const timeline = [];

    // Process works and collaborations
    graphData.links.forEach(link => {
        if (link.source === artistNode.id || link.target === artistNode.id) {
            const otherNodeId = link.source === artistNode.id ? link.target : link.source;
            const otherNode = graphData.nodes.find(n => n.id === otherNodeId);
            
            if (!otherNode) return;

            if (otherNode['Node Type'] === 'Song' || otherNode['Node Type'] === 'Album') {
                works.add(otherNode.id);
                const songData = songsLookup.get(otherNode.id) || {};
                const genre = otherNode.genre || songData.genre;
                if (genre) genres.add(genre);
                
                const releaseDate = otherNode.release_date || songData.release_date;
                if (releaseDate) {
                    timeline.push({
                        date: new Date(releaseDate),
                        type: otherNode['Node Type'],
                        name: otherNode.name || `${otherNode['Node Type']} ${otherNode.id}`,
                        genre: genre || 'Unknown',
                        notable: otherNode.notable || false
                    });
                }
            } else if (otherNode['Node Type'] === 'Person') {
                collaborators.add(otherNode.id);
            }
        }
    });

    // Calculate success metrics
    const notableWorks = timeline.filter(work => work.notable).length;
    const timeToSuccess = calculateTimeToSuccess(timeline);
    const genreSpread = genres.size;
    const collaborationScore = calculateCollaborationScore(collaborators, graphData);

    return {
        timeline: timeline.sort((a, b) => a.date - b.date),
        notableWorks,
        timeToSuccess,
        genreSpread,
        collaborationScore,
        totalWorks: works.size,
        genres: Array.from(genres)
    };
}

function calculateTimeToSuccess(timeline) {
    if (timeline.length === 0) return null;
    
    const firstWork = timeline[0];
    const firstNotable = timeline.find(work => work.notable);
    
    if (!firstNotable) return null;
    
    return (firstNotable.date - firstWork.date) / (1000 * 60 * 60 * 24 * 365); // Years
}

function calculateCollaborationScore(collaborators, graphData) {
    let score = 0;
    collaborators.forEach(id => {
        const collaborator = graphData.nodes.find(n => n.id === id);
        if (collaborator && collaborator.notable) {
            score += 1;
        }
    });
    return score;
}

function findRisingStars(graphData, songsData, songsLookup, workCollaboratorsMap, nodeById) {
    const oceanusArtists = new Set();
    const risingStars = [];

    // Find Oceanus Folk artists
    graphData.nodes.forEach(node => {
        if (node['Node Type'] === 'Person') {
            const works = graphData.links.filter(link => 
                (link.source === node.id || link.target === node.id) &&
                ['PerformerOf', 'ComposerOf'].includes(link['Edge Type'])
            );

            const oceanusWorks = works.filter(link => {
                const workNode = graphData.nodes.find(n => 
                    n.id === (link.source === node.id ? link.target : link.source)
                );
                return workNode && (workNode.genre === 'Oceanus Folk' || 
                       (songsLookup.get(workNode.id) || {}).genre === 'Oceanus Folk');
            });

            if (oceanusWorks.length > 0) {
                oceanusArtists.add(node.id);
            }
        }
    });

    // Analyze each Oceanus artist
    // Use 2025 as the current year for synthetic data
    // Use 2039 as the current year for this filter
    const now = new Date(2039, 0, 1); // January 1, 2039
    const fiveYearsAgo = new Date(2034, 0, 1); // January 1, 2034
    oceanusArtists.forEach(artistId => {
        const artist = graphData.nodes.find(n => n.id === artistId);
        if (!artist) return;

        const metrics = processArtistMetrics(artist.name, graphData, songsData, songsLookup);
        if (metrics && metrics.notableWorks > 0 && metrics.timeline.length >= 3) {
            // Only consider if at least one work in the last 5 years (2034-2039)
            const hasRecentWork5y = metrics.timeline.some(work => work.date >= fiveYearsAgo && work.date < now);
            if (hasRecentWork5y) {
                // Filter timeline to last 5 years
                const timeline5y = metrics.timeline.filter(work => work.date >= fiveYearsAgo);
                // Calculate metrics for last 5 years
                const notableWorks5y = timeline5y.filter(work => work.notable).length;
                const genreSet5y = new Set(timeline5y.map(work => work.genre));
                const genreSpread5y = genreSet5y.size;
                // Calculate collaboration score for last 5 years
                // Find all collaborators from works in the last 5 years
                const collaboratorIds5y = new Set();
                timeline5y.forEach(work => {
                    const collaborators = workCollaboratorsMap.get(work.id) || new Set();
                    collaborators.forEach(pid => {
                        if (pid !== artist.id) {
                            const person = nodeById.get(pid);
                            if (person && person.notable) {
                                collaboratorIds5y.add(pid);
                            }
                        }
                    });
                });
                const collaborationScore5y = collaboratorIds5y.size;
                // Potential score for last 5 years
                const metrics5y = {
                    notableWorks: notableWorks5y,
                    genreSpread: genreSpread5y,
                    collaborationScore: collaborationScore5y,
                    timeToSuccess: metrics.timeToSuccess // keep as is, or recalc if needed
                };
                const score5y = calculatePotentialScore(metrics5y);
                // Log artist info in the requested format (last 5 years)
                console.log(`\n${artist.name}\nNotable Works\n${notableWorks5y}\nGenre Spread\n${genreSpread5y}\nCollaboration Score\n${collaborationScore5y}\nPotential Score ${score5y.toFixed(1)} (last 5 years)`);
                risingStars.push({
                    name: artist.name,
                    metrics,
                    score: score5y
                });
            }
        }
    });

    return risingStars.sort((a, b) => b.score - a.score).slice(0, 5);
}

function calculatePotentialScore(metrics) {
    const timeToSuccessScore = metrics.timeToSuccess ? Math.max(0, 5 - metrics.timeToSuccess) : 0;
    const notableWorksScore = metrics.notableWorks * 2;
    const genreSpreadScore = metrics.genreSpread;
    const collaborationScore = metrics.collaborationScore * 1.5;
    
    return timeToSuccessScore + notableWorksScore + genreSpreadScore + collaborationScore;
}

function calculateAverageTimeToSuccess(artistMetrics) {
    const times = Array.from(artistMetrics.values())
        .filter(metrics => metrics && metrics.timeToSuccess)
        .map(metrics => metrics.timeToSuccess);
    
    return times.length > 0 ? d3.mean(times) : null;
}

function findKeyCollaborations(artistMetrics, graphData) {
    const collaborations = new Map();
    
    artistMetrics.forEach((metrics, artist) => {
        const artistNode = graphData.nodes.find(n => n.name === artist);
        if (!artistNode) return;

        graphData.links.forEach(link => {
            if (link.source === artistNode.id || link.target === artistNode.id) {
                const otherNodeId = link.source === artistNode.id ? link.target : link.source;
                const otherNode = graphData.nodes.find(n => n.id === otherNodeId);
                
                if (otherNode && otherNode.type === 'Person' && otherNode.notable) {
                    const key = `${artist}-${otherNode.name}`;
                    collaborations.set(key, (collaborations.get(key) || 0) + 1);
                }
            }
        });
    });

    return Array.from(collaborations.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([key, count]) => ({
            artists: key.split('-'),
            count
        }));
}

function calculateGenreVersatility(artistMetrics) {
    return Array.from(artistMetrics.entries())
        .filter(([_, metrics]) => metrics && metrics.genres) // Add null check
        .map(([artist, metrics]) => ({
            artist,
            genres: metrics.genres || [],
            versatility: metrics.genreSpread || 0
        }));
}

function initializeTrajectoryChart(trajectoryData) {
    try {
        // Setup artist filter buttons
        const artistFilter = document.querySelector('.artist-filter');
        artistFilter.innerHTML = trajectoryData.map((d, i) => `
            <button class="filter-btn ${i === 0 ? 'active' : ''}" data-artist="${d.artist}">
                ${d.artist}
            </button>
        `).join('');

        // Add time filter
        const timeFilter = document.createElement('div');
        timeFilter.className = 'time-filter';
        timeFilter.style.right = '150px';
        document.querySelector('.trajectory-section').appendChild(timeFilter);

        // Get unique years from all trajectories
        const years = Array.from(new Set(
            trajectoryData.flatMap(d => d.timeline.map(t => t.date.getFullYear()))
        )).sort();

        timeFilter.innerHTML = `
            <button class="time-btn active" data-year="all">All Time</button>
            ${years.map(year => `
                <button class="time-btn" data-year="${year}">${year}</button>
            `).join('')}
        `;

        // Add event listeners to filter buttons
        const filterButtons = document.querySelectorAll('.filter-btn');
        const timeButtons = document.querySelectorAll('.time-btn');
        let selectedArtists = [trajectoryData[0].artist];
        let selectedYear = 'all';

        filterButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                // Toggle active state
                btn.classList.toggle('active');
                const artist = btn.dataset.artist;
                
                // Update selected artists
                if (btn.classList.contains('active')) {
                    selectedArtists.push(artist);
                } else {
                    selectedArtists = selectedArtists.filter(a => a !== artist);
                }
                
                // Ensure at least one artist is selected
                if (selectedArtists.length === 0) {
                    btn.classList.add('active');
                    selectedArtists.push(artist);
                }
                
                updateChart(trajectoryData, selectedArtists, selectedYear);
            });
        });

        timeButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                timeButtons.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                selectedYear = btn.dataset.year;
                updateChart(trajectoryData, selectedArtists, selectedYear);
            });
        });

        // Initial chart render
        updateChart(trajectoryData, selectedArtists, selectedYear);
    } catch (error) {
        console.error('Error initializing trajectory chart:', error);
        document.querySelector('.trajectory-section').innerHTML = `
            <div style="color: red; padding: 20px;">
                Error initializing trajectory chart. Please check the console for details.
            </div>
        `;
    }
}

function updateChart(trajectoryData, selectedArtists, selectedYear) {
    // Filter data for selected artists
    const filteredData = trajectoryData.filter(d => selectedArtists.includes(d.artist));
    
    // Get all timeline events for selected artists
    const allTimelineData = filteredData.flatMap(d => 
        d.timeline.map(event => ({...event, artist: d.artist}))
    );
    
    // Apply time filter
    let timelineData = allTimelineData;
    if (selectedYear !== 'all') {
        timelineData = timelineData.filter(d => d.date.getFullYear().toString() === selectedYear);
    }
    
    const margin = {top: 10, right: 100, bottom: 30, left: 50};
    const container = document.querySelector('.trajectory-section');
    const width = container.clientWidth - margin.left - margin.right - 20;
    
    // Calculate optimal height based on data points
    const maxDataPoints = Math.max(...filteredData.map(d => d.timeline.length));
    const minHeight = 400; // Minimum height
    const pointSpacing = 15; // Vertical space between points
    const calculatedHeight = Math.max(minHeight, maxDataPoints * pointSpacing);
    const height = Math.min(calculatedHeight, window.innerHeight - 150); // Cap at viewport height minus padding

    // Clear existing chart
    d3.select('#trajectory-chart').html('');

    const svg = d3.select('#trajectory-chart')
        .attr('width', width + margin.left + margin.right)
        .attr('height', height + margin.top + margin.bottom)
        .append('g')
        .attr('transform', `translate(${margin.left},${margin.top})`);

    // Create scales
    const xScale = d3.scaleTime()
        .domain([
            d3.min(timelineData, d => d.date),
            d3.max(timelineData, d => d.date)
        ])
        .range([0, width]);

    // Create color scale for artists
    const colorScale = d3.scaleOrdinal()
        .domain(selectedArtists)
        .range(['#1ed760', '#ff6b6b', '#4ecdc4']);

    // Adjust y scale to start from a lower number
    const yScale = d3.scaleLinear()
        .domain([0, maxDataPoints])
        .range([height, 0])
        .nice();

    // Add axes
    svg.append('g')
        .attr('transform', `translate(0,${height})`)
        .call(d3.axisBottom(xScale))
        .selectAll('text')
        .style('fill', '#B3B3B3')
        .attr('transform', 'rotate(-45)')
        .style('text-anchor', 'end');

    svg.append('g')
        .call(d3.axisLeft(yScale))
        .selectAll('text')
        .style('fill', '#B3B3B3');

    // Add grid lines
    svg.append('g')
        .attr('class', 'grid')
        .attr('opacity', 0.1)
        .call(d3.axisLeft(yScale)
            .tickSize(-width)
            .tickFormat(''));

    // Create line generator
    const line = d3.line()
        .x(d => xScale(d.date))
        .y((_, i) => yScale(i + 1))
        .curve(d3.curveMonotoneX);

    // Add lines for each artist
    filteredData.forEach(artistData => {
        let artistTimeline = artistData.timeline;
        if (selectedYear !== 'all') {
            artistTimeline = artistTimeline.filter(d => d.date.getFullYear().toString() === selectedYear);
        }

        svg.append('path')
            .datum(artistTimeline)
            .attr('class', 'trajectory-line')
            .attr('fill', 'none')
            .attr('stroke', colorScale(artistData.artist))
            .attr('stroke-width', 2)
            .attr('d', line);

        // Add points for each artist
        svg.selectAll(`.work-point-${artistData.artist.replace(/\s+/g, '-')}`)
            .data(artistTimeline)
            .enter()
            .append('circle')
            .attr('class', 'work-point')
            .attr('cx', d => xScale(d.date))
            .attr('cy', (_, i) => yScale(i + 1))
            .attr('r', 6)
            .attr('fill', d => d.type === 'Album' ? '#ff6b6b' : '#4ecdc4')
            .attr('stroke', '#fff')
            .attr('stroke-width', 2)
            .style('cursor', 'pointer')
            .style('filter', 'drop-shadow(0 2px 2px rgba(0,0,0,0.3))')
            .on('mouseover', (event, d) => {
                const circle = d3.select(event.currentTarget);
                circle.transition()
                    .duration(200)
                    .attr('r', 8);
                
                showWorkTooltip(event, {
                    ...d,
                    artist: artistData.artist,
                    workNumber: artistTimeline.indexOf(d) + 1
                });
            })
            .on('mouseout', (event) => {
                const circle = d3.select(event.currentTarget);
                circle.transition()
                    .duration(200)
                    .attr('r', 6);
                hideTooltip();
            });

        // Add artist label at the end of their line
        if (artistTimeline.length > 0) {
            const lastPoint = artistTimeline[artistTimeline.length - 1];
            svg.append('text')
                .attr('class', 'artist-label')
                .attr('x', xScale(lastPoint.date) + 10)
                .attr('y', yScale(artistTimeline.length))
                .style('fill', colorScale(artistData.artist))
                .style('font-size', '12px')
                .style('font-weight', 'bold')
                .text(artistData.artist);
        }
    });

    // Add legend
    const legend = svg.append('g')
        .attr('class', 'legend')
        .attr('transform', `translate(${width + 10}, 0)`);

    const legendData = [
        { label: "Song", color: "#4ecdc4" },
        { label: "Album", color: "#ff6b6b" }
    ];

    legend.selectAll("circle")
        .data(legendData)
        .enter()
        .append("circle")
        .attr("cx", 0)
        .attr("cy", (d, i) => i * 25)
        .attr("r", 6)
        .attr("fill", d => d.color);

    legend.selectAll("text")
        .data(legendData)
        .enter()
        .append("text")
        .attr("x", 15)
        .attr("y", (d, i) => i * 25 + 4)
        .text(d => d.label)
        .attr("fill", "#B3B3B3")
        .style("font-size", "12px");
}

function initializeMetricsPanel(metrics) {
    try {
        // Update average time to success
        const timeToSuccessValue = document.querySelector('[data-metric="timeToSuccess"] .metric-value');
        if (timeToSuccessValue) {
            timeToSuccessValue.textContent = metrics.averageTimeToSuccess ? 
                `${metrics.averageTimeToSuccess.toFixed(1)} years` : 'N/A';
        }

        // Update key collaborations
        const collabList = document.querySelector('[data-metric="collaborations"] .metric-list');
        if (collabList) {
            collabList.innerHTML = metrics.keyCollaborations
                .map(collab => `
                    <div class="metric-item">
                        <span>${collab.artists.join(' & ')}</span>
                        <span class="count">${collab.count}</span>
                    </div>
                `)
                .join('');
        }

        // Update genre versatility
        const versatilityList = document.querySelector('[data-metric="versatility"] .metric-list');
        if (versatilityList) {
            versatilityList.innerHTML = metrics.genreVersatility
                .sort((a, b) => b.versatility - a.versatility)
                .map(artist => `
                    <div class="metric-item">
                        <span>${artist.artist}</span>
                        <span class="count">${artist.versatility} genres</span>
                    </div>
                `)
                .join('');
        }
    } catch (error) {
        console.error('Error initializing metrics panel:', error);
        document.querySelector('.metrics-section').innerHTML = `
            <div style="color: red; padding: 20px;">
                Error initializing metrics panel. Please check the console for details.
            </div>
        `;
    }
}

function initializePredictions(predictions) {
    try {
        const predictionsList = document.getElementById('predictions');
        if (predictionsList) {
            predictionsList.innerHTML = predictions
                .map(star => `
                    <div class="prediction-card">
                        <div class="prediction-artist">${star.name}</div>
                        <div class="prediction-stats">
                            <div class="metric-row">
                                <span class="metric-label">Notable Works</span>
                                <span class="metric-value">${star.metrics.notableWorks}</span>
                            </div>
                            <div class="metric-row">
                                <span class="metric-label">Genre Spread</span>
                                <span class="metric-value">${star.metrics.genreSpread}</span>
                            </div>
                            <div class="metric-row">
                                <span class="metric-label">Collaboration Score</span>
                                <span class="metric-value">${star.metrics.collaborationScore}</span>
                            </div>
                        </div>
                        <div class="prediction-score">
                            <span class="metric-label">Potential Score</span>
                            <span class="metric-value">${star.score.toFixed(1)}</span>
                        </div>
                    </div>
                `)
                .join('');
        }
    } catch (error) {
        console.error('Error initializing predictions:', error);
        document.querySelector('.prediction-section').innerHTML = `
            <div style="color: red; padding: 20px;">
                Error initializing predictions. Please check the console for details.
            </div>
        `;
    }
}

function showWorkTooltip(event, data) {
    const tooltip = d3.select('#tooltip');
    tooltip.style('display', 'block')
        .style('left', (event.pageX + 10) + 'px')
        .style('top', (event.pageY + 10) + 'px')
        .html(`
            <div style="border-left: 3px solid ${data.type === 'Album' ? '#ff6b6b' : '#4ecdc4'}; padding-left: 8px;">
                <div style="font-size: 14px; font-weight: bold; color: #1ed760; margin-bottom: 8px;">
                    ${data.name}
                </div>
                <div>Artist: ${data.artist}</div>
                <div>Type: ${data.type}</div>
                <div>Genre: ${data.genre}</div>
                <div>Release Date: ${data.date.toLocaleDateString()}</div>
                <div>Work #${data.workNumber}</div>
                ${data.notable ? '<div style="color: #1ed760; margin-top: 4px;">⭐ Notable Work</div>' : ''}
            </div>
        `);
}

function hideTooltip() {
    d3.select('#tooltip').style('display', 'none');
}