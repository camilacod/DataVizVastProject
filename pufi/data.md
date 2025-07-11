# MC1_graph.json Data Description

## Overview
MC1_graph.json represents a musical influence network dataset from VAST 2025 MC1 challenge. It contains a directed multigraph structure representing relationships between various musical entities.

## File Structure
The file follows a node-link JSON format compatible with NetworkX's node_link_graph() function:

```json
{
  "nodes": [
    {
      "id": "unique_identifier",
      "name": "entity_name",
      "Node Type": "one_of_node_types",
      "genre": "music_genre",  // optional
      "notable": boolean,      // optional
      "release_date": "date",  // optional
      "notoriety_date": "date" // optional
    }
    // ... more nodes
  ],
  "links": [
    {
      "source": "source_node_id",
      "target": "target_node_id",
      "Edge Type": "relationship_type"
    }
    // ... more links
  ]
}
```

## Data Characteristics
- **Nodes**: 17,412 total nodes
- **Edges**: 37,857 total edges
- **Network Type**: Directed multigraph (multiple edges allowed between same nodes)
- **Connected Components**: 16 weakly connected components

## Node Types (5 categories)
1. Person (65.2%): 11,361 nodes
2. Song (20.8%): 3,615 nodes
3. RecordLabel (7.0%): 1,217 nodes
4. Album (5.7%): 996 nodes
5. MusicalGroup (1.3%): 223 nodes

## Edge Types (Relationship Categories)
1. **Professional Roles**:
   - PerformerOf
   - ComposerOf
   - ProducerOf
   - LyricistOf

2. **Creative Influences**:
   - InStyleOf
   - InterpolatesFrom
   - CoverOf
   - LyricalReferenceTo
   - DirectlySamples

3. **Business Relationships**:
   - RecordedBy
   - DistributedBy

4. **Membership**:
   - MemberOf

## Processing Guidelines
1. **Loading the Data**:
   ```python
   import json
   import networkx as nx
   
   with open('MC1_graph.json', 'r', encoding='utf-8') as f:
       graph_data = json.load(f)
   
   G = nx.node_link_graph(graph_data)
   ```

2. **Node Attributes to Consider**:
   - `Node Type`: Categorizes the entity
   - `name`: Entity identifier
   - `genre`: Musical genre (for Songs/Albums)
   - `notable`: Success indicator (boolean)
   - `release_date`: Publication date
   - `notoriety_date`: Date when became notable

3. **Edge Analysis**:
   - Group edges by type for different analyses
   - Consider direction for influence flow
   - Track temporal patterns using dates
   - Analyze creative influence patterns separately

4. **Success Analysis**:
   - Focus on `notable` attribute
   - Track time between `release_date` and `notoriety_date`
   - Analyze influence patterns leading to notable works

## Key Metrics
- Network density: 0.000125
- Average in/out degree: 2.17
- Largest connected component: 99.2% of nodes
- Notable works: 93.2% of songs/albums