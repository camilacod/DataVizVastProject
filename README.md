# **Project Proposal**

*Professor Germain Garcia‑Zanabria*
*Data Science Program — DS5343 • Data Visualization*
*Final Project Guidelines*

---

## Team

* **Camila Rodríguez**
* **Martín Pérez‑Bonany**
* **Diego Guerra**

---




##  Objective

Leverage the synthetic **VAST 2025 MC1 music‑influence graph** to uncover how creative relationships (covers, samples, stylistic homage, collaborations) drive a song or album from obscurity to *notable* chart success. We will deliver an **interactive, story‑driven visualization** that allows users to trace these pathways and explore the ecosystem of musical influence.

---

## Possible Research Questions

1. **Influence Propagation:** How do different influence types (Cover Of, Directly Samples, In Style Of, etc.) spread across time and genre?
2. **Collaboration & Success:** Which collaboration patterns between artists, producers, labels and groups correlate most with “notable” status?
3. **Keystone Creators:** Can we identify songs, albums, or people whose removal would fragment the influence network (high betweenness/bridging nodes)?
4. **Genre Evolution Timeline:** What temporal milestones mark genre shifts driven by cross‑influences and chart breakthroughs?

---

## Data & Pre‑processing (Python)

This part will be accomplished using Python and libraries such as pandas, networkx, numpy, scikit-network, matplotlib.

---

## Visualization Approach (JS + D3 v7)

| View                            | Purpose                                  | Key Encodings                                |
| ------------------------------- | ---------------------------------------- | -------------------------------------------- |
| **Radial Influence Galaxy**     | Macro overview of the graph              | Radius → release year · Link hue → edge type |
| **Collaboration Chord Diagram** | Artist‑producer‑label triads             | Arc size → #works · Color → genre            |
| **Success Sankey**              | Pathways from creation ➜ chart notoriety | Width → frequency · Node color → role        |
| **Timeline Heatmap**            | Genre popularity across years            | Color intensity → #notable hits              |

Interactive features: hover tooltips, click‑to‑filter, animated transitions.

---

##  Stack

* **Python 3.11** • `pandas`, `networkx`, `numpy`, `scikit‑network`,    `matplotlib`
* **JavaScript** • **D3 v7**.


---

## Visualizations

### Timeline Heatmap (`timeline_heatmap.html`)

An interactive timeline heatmap visualization that explores musical genre evolution over time, featuring a Spotify-inspired design aesthetic.

#### Features

**Data Representation**
- **Heatmap Matrix**: Genres (Y-axis) × Time periods (X-axis)
- **Color Encoding**: Activity intensity using Spotify-themed green color scale
- **Time Granularity**: View by year, decade, or 5-year periods
- **Multiple Metrics**: Total releases, notable works, success rate, or influence activity

**Interactive Controls**
- **View Modes**: 
  - Total Releases: Shows all musical works released
  - Notable Works: Filters to only chart-successful pieces
  - Success Rate: Percentage of works that became notable
  - Influence Activity: Sum of creative influences (samples, covers, etc.)
- **Animation**: Automated timeline playback with speed control
- **Genre Selection**: Adjustable number of top genres to display (5-20)
- **Click Interactions**: Click genre labels to highlight specific genres

**Rich Tooltips**
Hover over any cell to see:
- Genre and time period information
- Current metric value with context
- Comprehensive statistics (total works, notable works, influences, success rate)
- Top works in that genre/period with influence indicators

### Collaboration Chord Diagram (`collaboration_chord.html`)

An interactive chord diagram visualization showcasing artist-producer-label collaboration triads within the musical influence network, featuring Spotify-inspired aesthetics and comprehensive filtering capabilities.

#### Features

**Data Representation**
- **Chord Layout**: D3's chord diagram displaying collaboration matrices between entities
- **Arc Size Encoding**: Entity arc size represents total number of works produced
- **Color Encoding**: Genre-based color scheme using Spotify green variations
- **Entity Types**: Artists/People, Producers, and Record Labels with distinct visual styling
- **Matrix Analysis**: Top 20 entities by work count to ensure readability

**Interactive Controls**
- **Genre Filtering**: Focus on specific genres while preserving collaboration context
- **Collaboration Strength**: Filter by strong (5+ works), medium (2-4 works), or weak (1 work) collaborations
- **Work Count Slider**: Adjustable minimum works threshold (1-10)
- **Opacity Control**: Customize chord ribbon transparency for better visibility
- **Label Toggle**: Show/hide entity names around the diagram
- **Notable Works Filter**: Focus on entities involved in chart-successful works

**Rich Interactions**
- **Entity Tooltips**: Hover over arcs to see role, genre, work count, collaboration details, and notable status
- **Collaboration Tooltips**: Hover over ribbons to see detailed collaboration information between entities
- **Genre Tags**: Quick-filter buttons for top genres in the sidebar legend
- **Visual Highlighting**: Chord ribbons highlight on hover with stroke effects

**Live Statistics**
- **Active Triads**: Current number of entities displayed
- **Total Works**: Aggregate work count across filtered entities  
- **Dominant Genre**: Most prominent genre by work volume in current view

