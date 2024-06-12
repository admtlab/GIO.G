
// object to represent the corridor graph for a building
class CorridorGraph {
    
    // initialize the graph
    constructor() {
        this.nodes = [];
        this.edges = [];
        this.temp_lines = [];
    }

    // add a new line to the graph
    add_line(line, start_point_is_node=false) {

        this.temp_lines.push(line);

        // do not add lines that are already in the graph
        if (this.line_in_graph(line)) {
            return;
        }

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
        if (start_point_is_node) {
            let node = this.create_node(line[0]);
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
                return true;
            }
        }

        return false;
    }

    // creates a new node for a given point
    create_node(point) {
        return {
            point: point,
            left: null,
            right: null,
            up: null,
            down: null
        };
    }

    // sets the neighbors of nodes in each edge
    set_node_neighbors() {

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
                }
            }
        }
    }
}


// calculate building corridors
function calculate_building_corridor_graph(cell_info) {

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

            corridor_graph_find_internal_line(graph, edges, midpoint, ei, false);
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
        corridor_graph_find_internal_line(graph, edges, door_coords, door_mod.attached_wall_outline_index, true);
    }

    // set the neighbors of every node in the graph
    graph.set_node_neighbors();
}


// find interior line to opposing wall from a point on a given wall
function corridor_graph_find_internal_line(graph, edges, point, edge_index, start_point_is_node=false) {
    
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
    graph.add_line(new_graph_line, start_point_is_node);
}