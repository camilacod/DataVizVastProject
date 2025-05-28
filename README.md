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








