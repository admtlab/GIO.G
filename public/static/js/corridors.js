
// object to represent the corridor graph for a building
class CorridorGraph {
    
    // initialize the graph
    constructor() {
        this.nodes = [];
        this.edges = [];
        this.temp_lines = [];
        this.min_span_edges = [];
        this.min_span_nodes = [];
    }

    // add a new line to the graph
    add_line(line, start_point_door_id=-1) {

        this.temp_lines.push(line);

        // do not add lines that are already in the graph
        let edge = this.line_in_graph(line);

        // TODO: attempted to not add duplicate lines (want to also support adding a door as an end point for existing lines)
        // if (edge !== null) {
        //     if (start_point_door_id > -1) {
        //         let start_point = line[0];

        //         let found_node = false;
        //         for (let ni = 0; ni < edge.nodes.length; ni++) {
        //             let node = edge.nodes[ni];
        //             if (coords_eq(node.point, start_point)) {
        //                 found_node = true;
        //                 break;
        //             }
        //         }

        //         if (!found_node) {
        //             edge.nodes.push(this.create_node(start_point));
        //         }
        //     }
        //     return;
        // }

        // determine if the line is vertical or horizontal
        let line_orientation = calc_line_orthogonal_direction(line[0], line[1]);
        if (line_orientation === null) {
            return;
        }

        // create edge object for the new line
        let new_edge = {
            line: line,
            orientation: line_orientation,
            nodes: []
        };

        // add the line's start point as a node if enabled
        if (start_point_door_id > -1) {
            let node = this.create_node(line[0], start_point_door_id);
            new_edge.nodes.push(node);
            this.nodes.push(node);
        }

        // check intersections with all other edges in the graph
        for (let ei = 0; ei < this.edges.length; ei++) {
            let edge = this.edges[ei];

            // skip parallel lines
            if (edge.orientation === line_orientation) {
                continue;
            }

            // check for intersection
            let intersection = calc_lines_intersection(edge.line, line);
            if (intersection === null) {
                continue;
            }

            // create a node for the intersection
            let node = this.create_node(intersection);

            // add the node to the parent edges and graph
            new_edge.nodes.push(node);
            edge.nodes.push(node);
            this.nodes.push(node);
        }
        
        // add the new edge to the graph
        this.edges.push(new_edge);
    }

    // checks if a given line exists in the graph
    line_in_graph(line) {

        for (let ei = 0; ei < this.edges.length; ei++) {
            let edge = this.edges[ei];

            if (lines_eq(line, edge.line)) {
                return edge;
            }
        }

        return null;
    }

    // creates a new node for a given point
    create_node(point, door_id=-1) {
        return {
            point: point,
            door_id: door_id,
            left: null,
            right: null,
            up: null,
            down: null,
            weight: Number.MAX_SAFE_INTEGER,
            mst_parent: null,
            mst_children: [],
            neighbors: []
        };
    }

    // sets the neighbors of nodes in each edge
    set_node_neighbors() {

        // reset the neighbors of every node
        for (let ni = 0; ni < this.nodes.length; ni++) {
            let node = this.nodes[ni];

            node.left = null;
            node.right = null;
            node.up = null;
            node.down = null;
            node.neighbors = [];
        }

        // iterate over every edge
        for (let ei = 0; ei < this.edges.length; ei++) {
            let edge = this.edges[ei];

            if (edge.orientation === "horizontal") {

                // sort the nodes based on their x coordinate
                edge.nodes.sort((a, b) => a.point.x - b.point.x);

                // set the right / left field for each node in the horizontal line
                for (let ni = 0; ni < edge.nodes.length - 1; ni++) {

                    let curr_node = edge.nodes[ni];
                    let next_node = edge.nodes[ni+1];

                    curr_node.right = next_node;
                    next_node.left = curr_node;
                    curr_node.neighbors.push(next_node);
                    next_node.neighbors.push(curr_node);
                }

            } else if (edge.orientation === "vertical") {

                // sort the nodes based on their y coordinate
                edge.nodes.sort((a, b) => a.point.y - b.point.y);

                // set the right / left field for each node in the horizontal line
                for (let ni = 0; ni < edge.nodes.length - 1; ni++) {

                    let curr_node = edge.nodes[ni];
                    let next_node = edge.nodes[ni+1];

                    curr_node.down = next_node;
                    next_node.up = curr_node;
                    curr_node.neighbors.push(next_node);
                    next_node.neighbors.push(curr_node);
                }
            }
        }
    }

    // create the minimum spanning tree for nodes in the graph
    create_min_span() {
        
        if (this.nodes.length === 0) {
            return;
        }

        // reset the node neighbors
        this.set_node_neighbors();

        this.min_span_edges = [];
        this.min_span_nodes = [];

        // set all nodes weight to max
        this.nodes.forEach(node => {
            node.weight = Number.MAX_SAFE_INTEGER;
            node.mst_children = [];
        });

        // set the weight of the first node to 0
        this.nodes[0].weight = 0;
        
        // construct the spanning tree
        while (this.min_span_nodes.length < this.nodes.length) {

            this.nodes.sort((a, b) => a.weight - b.weight);
            let next_node = null;

            // find the node not in the minimum spanning nodes with the minimum weight
            for (let ni = 0; ni < this.nodes.length; ni++) {
                let node = this.nodes[ni];
                if (this.min_span_nodes.indexOf(node) === -1) {
                    next_node = node;
                    break;
                }
            }

            // add new node to the spanning tree
            this.min_span_nodes.push(next_node);
            if (next_node.mst_parent !== null) {
                // this.min_span_edges.push([next_node.point, next_node.mst_parent.point]);
                next_node.mst_parent.mst_children.push(next_node);
            }
            
            // set the weights of the new node's neighbors
            for (let ni = 0; ni < next_node.neighbors.length; ni++) {
                let node = next_node.neighbors[ni];
                let weight = calc_dist(next_node.point, node.point);

                // update the weight and parent of the neighbor if it is better than the current weight
                if (this.min_span_nodes.indexOf(node) === -1 && weight < node.weight) {
                    node.weight = weight;
                    node.mst_parent = next_node;
                }
            }
        }

        // remove endpoints that point to nowhere
        this.prune_span();

        // construct edges from nodes
        this.min_span_nodes.forEach(node => {
            if (node.mst_parent !== null) {
                this.min_span_edges.push([node.point, node.mst_parent.point]);
            }
        });

        // console.log(this.find_path(this.min_span_nodes[0], this.min_span_nodes[this.min_span_nodes.length-1]));
    }

    // prune spanning endpoints that do not lead to doors
    prune_span() {
        
        if (this.min_span_nodes.length === 0) {
            return;
        }

        let num_removed_nodes = -1;

        // repeat until no more nodes have been removed
        while (num_removed_nodes !== 0) {

            let indexes_to_remove = [];

            // iterate over every node
            for (let i = 0; i < this.min_span_nodes.length; i++) {
                let node = this.min_span_nodes[i];

                // remove nodes that do not have any children
                if (node.door_id === -1 && node.mst_children.length === 0) {
                    indexes_to_remove.push(i);
                }
            }

            // remove nodes from the minimum spanning tree nodes list
            indexes_to_remove.reverse();
            indexes_to_remove.forEach((index) => {
                let node = this.min_span_nodes[index];
                if (node.mst_parent) {
                    node.mst_parent.mst_children.splice(node.mst_parent.mst_children.indexOf(node), 1);
                }
                this.min_span_nodes.splice(index, 1);
            });

            num_removed_nodes = indexes_to_remove.length;
        }
    }

    // find path from one node to another node
    find_path(start_node, end_node, coordinates_result=false) {

        let path = [];
        let visited = [];

        // recursive function to find the path between nodes
        function find_path_rec(curr_node, end_node) {
            
            // push the current node onto the path
            path.push(curr_node);
            visited.push(curr_node);

            // base case, found the end node
            if (curr_node === end_node) {
                return true;
            }

            // recursive call for each of the node's children
            for (let ni = 0; ni < curr_node.mst_children.length; ni++) {
                let child_node = curr_node.mst_children[ni];

                if (visited.indexOf(child_node) > -1) {
                    continue;
                }

                let found_path = find_path_rec(child_node, end_node);
                if (found_path) {
                    return true;
                }

                path.pop();
            }
            
            // recursive call for the node's parent
            if (curr_node.mst_parent !== null && visited.indexOf(curr_node.mst_parent) === -1) {
                let found_path = find_path_rec(curr_node.mst_parent, end_node);
                if (found_path) {
                    return true;
                }

                path.pop();
            }

            return false;
        }

        // kickoff the recursive call
        find_path_rec(start_node, end_node);

        if (coordinates_result) {
            path = path.map((node) => node.point);
        }

        return path;
    }

    // find a node that has a given door id
    node_with_door_id(door_id) {
        
        for (let ni = 0; ni < this.min_span_nodes.length; ni++) {
            let node = this.min_span_nodes[ni];
            if (node.door_id == door_id) {
                return node;
            }
        }

        return null;
    }

    // find a path given two door ids
    find_door_path(start_door_id, end_door_id) {

        // get the nodes associated with each door id
        let start_node = this.node_with_door_id(start_door_id);
        let end_node = this.node_with_door_id(end_door_id);

        // check if matching nodes were found
        if (start_node === null || end_node === null) {
            return [];
        }

        // return coordinates of nodes in a path
        return this.find_path(start_node, end_node, true);
    }

    // get arbitrary node that has a door
    get_door_node() {

        for (let ni = 0; ni < this.min_span_nodes.length; ni++) {
            let node = this.min_span_nodes[ni];
            if (node.door_id != -1) {
                return node;
            }
        }

        return null;
    }

    // get a path that fully connects every node
    get_full_path(coordinates_result=true) {

        let min_span_nodes = this.min_span_nodes;
        if (min_span_nodes.length === 0) {
            return [];
        }
        
        let path = [];
        let visited = [];

        // recursive function to find the path between nodes
        function find_path_rec(curr_node) {
            
            // push the current node onto the path
            path.push(curr_node);
            visited.push(curr_node);

            // recursive call for each of the node's children
            for (let ni = 0; ni < curr_node.mst_children.length; ni++) {
                let child_node = curr_node.mst_children[ni];

                if (visited.indexOf(child_node) > -1) {
                    continue;
                }

                find_path_rec(child_node);
                path.push(curr_node);
            }
            
            // recursive call for the node's parent
            if (curr_node.mst_parent !== null && visited.indexOf(curr_node.mst_parent) === -1) {
                find_path_rec(curr_node.mst_parent);
                path.push(curr_node);
            }

            return false;
        }

        // kickoff the recursive call
        find_path_rec(this.get_door_node());

        if (coordinates_result) {
            path = path.map((node) => node.point);
        }

        return path;
    }
}


// calculate building corridors
function calculate_building_corridors(cell_info) {

    // console.log("calculating building corridor graph for: ", cell_info)

    let graph = new CorridorGraph();
    cell_info.building_mods.corridor_graph = graph;

    // create an edge object for ever wall in the building
    let edges = cell_info.building_mods.outline_grid_walls.map((edge) => { 
        return {
            edge: edge,
            orientation: calc_line_orthogonal_direction(edge[0], edge[1]),
            splits: []
        };
    });

    // split up each edge into sections based on perpendicular edges
    for (let ei = 0; ei < edges.length; ei++) {
        let edge = edges[ei];
        let splits = [];

        if (edge.orientation === "vertical") {
            splits.push(edge.edge[0].y, edge.edge[1].y);
        } else if (edge.orientation === "horizontal") {
            splits.push(edge.edge[0].x, edge.edge[1].x);
        }

        // iterate over perpendicular edges
        for (let ej = 0; ej < edges.length; ej++) {

            let comp_edge = edges[ej];

            // skip the same edge, adjacent edges, and parallel edges
            if (ej === ei || ej === (ei + 1) % edges.length || (ei + edges.length - 1) % edges.length || edge.orientation === comp_edge.orientation) {
                continue;
            }

            // check if the perpendicular line would split the current edge
            if ((edge.orientation === "vertical" && (edge.edge[0].y < comp_edge.edge[0].y && edge.edge[1].y > comp_edge.edge[0].y))) {
                splits.push(comp_edge.edge[0].y);
            } else if (edge.orientation === "horizontal" && (edge.edge[0].x < comp_edge.edge[0].x && edge.edge[1].x > comp_edge.edge[0].x)) {
                splits.push(comp_edge.edge[0].x);
            }
        }

        // sort the splits along the edge
        splits.sort((a,b) => a - b);

        // create line objects for each split
        if (edge.orientation === "vertical") {
            let stable_coord = edge.edge[0].x;

            for (let si = 0; si < splits.length - 1; si++) {
                edge.splits.push([{x:stable_coord, y:splits[si]}, {x:stable_coord, y:splits[si+1]}]);
            }

        } else if (edge.orientation === "horizontal") {
            let stable_coord = edge.edge[0].y;

            for (let si = 0; si < splits.length - 1; si++) {
                edge.splits.push([{x:splits[si], y:stable_coord}, {x:splits[si+1], y:stable_coord}]);
            }
        }
    }

    // find line from split to boundary for every edge
    for (let ei = 0; ei < edges.length; ei++) {
        let edge = edges[ei];

        // iterate over every split in the edge
        for (let si = 0; si < edge.splits.length; si++) {
            let split = edge.splits[si];
            let midpoint = calc_midpoint(split[0], split[1]);

            corridor_graph_find_internal_line(graph, edges, midpoint, ei);
        }
    }

    // add doors to the graph
    for (let door_id in cell_info.building_mods.entrance_mods) {
        let door_mod = cell_info.building_mods.entrance_mods[door_id];
        
        // check if the door has an attached wall
        if (door_mod.attached_wall_outline_index === -1) {
            continue;
        }

        // add line from door
        let door_coords = grid_coords_for_building_or_door(door_mod.data_ref);
        corridor_graph_find_internal_line(graph, edges, door_coords, door_mod.attached_wall_outline_index, door_id);
    }

    // construct the minimum spanning tree for the corridor graph
    graph.create_min_span();
}


// find interior line to opposing wall from a point on a given wall
function corridor_graph_find_internal_line(graph, edges, point, edge_index, start_point_door_id=-1) {
    
    let edge = edges[edge_index];

    let far_point = null;

    // find a far away perpendicular point
    if (edge.orientation === "horizontal") {
        if (edge.edge[0].x > edge.edge[1].x) {
            far_point = {x: point.x, y: grid.length*-2};
        } else if (edge.edge[0].x < edge.edge[1].x) {
            far_point = {x: point.x, y: grid.length*2};
        }
    } else if (edge.orientation === "vertical") {
        if (edge.edge[0].y > edge.edge[1].y) {
            far_point = {x: grid.length*2, y: point.y};
        } else if (edge.edge[0].y < edge.edge[1].y) {
            far_point = {x: grid.length*-2, y: point.y};
        }
    }

    let far_line = [point, far_point];

    // find the edge that has the closest intersection
    let best_point = null;
    let best_dist = Number.MAX_SAFE_INTEGER;
    
    for (let ei = 0; ei < edges.length; ei++) {
        let comp_edge = edges[ei];
        
        // skip the same edge, adjacent edges, and perpendicular edges
        if (ei === edge_index || ei === (edge_index + 1) % edges.length || ei === (edge_index + edges.length - 1) % edges.length ||
            edge.orientation !== comp_edge.orientation) {
            continue;
        }
            
        let intersection = calc_lines_intersection(far_line, comp_edge.edge);
        if (intersection === null) {
            continue;
        }
        
        // find the intersection with the shortest distance
        let dist = calc_dist(point, intersection);
        if (dist < best_dist) {
            best_dist = dist;
            best_point = intersection;
        }
    }

    // check if an intersection was found
    if (best_point === null) {
        return;
    }

    // line to add to graph
    let new_graph_line = [point, best_point];
    graph.add_line(new_graph_line, start_point_door_id);
}