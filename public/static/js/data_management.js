
/* -------------------------------------------------------------------------- */
/*                               grid management                              */
/* -------------------------------------------------------------------------- */


// process a graph
function process_graph(buildings, grid_len) {

    // store current graph and config data
    current_graph = buildings

    // define new empty grid array to store building information
    grid = create_empty_grid(grid_len);

    // recalculate any cell dimensions
    calculate_main_draw_dims(grid_len);

    // actually process every building
    for (let b = 0; b < buildings.length; b++) {
        let building = buildings[b];
        process_building(building);
    }

    // generate new road widths for the grid
    generate_random_road_weights();

    // draw the graph on the main stage
    draw_main_stage();
}


// processes an incoming graph 
function process_generated_graph(buildings, config) {

    // store current graph and config data
    current_graph = buildings;
    current_config = config;
    
    // get size of grid based on current configuration 
    let grid_len = calc_grid_bounds(config);

    // actually process the graph
    process_graph(buildings, grid_len);
}


// processes a preset graph
function process_preset_graph(buildings) {

    let max_grid_len = Number.MIN_SAFE_INTEGER;

    // iterate over every building to find the highest coordinate value
    for (let b = 0; b < buildings.length; b++) {
        let building = buildings[b];

        // not converting 1-indexed to 0-indexed here since this is finding the length of the grid, not building index in the grid

        if (building.x > max_grid_len) {
            max_grid_len = building.x;
        }

        if (building.y > max_grid_len) {
            max_grid_len = building.y
        }
    }

    // actually process the graph
    process_graph(buildings, max_grid_len);
}


// process the uploaded file
function process_uploaded_graph(graph_text) {

    // convert the data to a json object
    let json = JSON.parse(graph_text);

    // TODO: input validation?

    process_preset_graph(json);
}


// prepare a filtered version of the current graph 
function filter_current_graph(include_closed_doors_and_buildings, include_few_doors_buildings) {
    
    let filtered_graph = [];

    // iterate over every grid cell
    for (let y = 0; y < grid.length; y++) {
        for (let x = 0; x < grid.length; x++) {

            let grid_coords = {x:x, y:y};
            let cell_info = grid_object_at_coords(grid_coords);
            let building_mods = cell_info.building_mods;
            let door_mods = building_mods.entrance_mods;

            // do not add the building to the list if it does not exist or if it is closed
            if (cell_info.building_data === null || (!building_mods.open && !include_closed_doors_and_buildings)) {
                continue;
            }

            let building = {
                ...cell_info.building_data
            };

            // ensure building object has congestion type (supports older graph files)
            if (!("congestion_type" in building)) {
                building.congestion_type = building_mods.con_level || "constant";
            }

            // ensure building object has merged x and y congestion type (supports older graph files)
            if (!("merged_x" in building) || !("merged_y" in building)) {
                building.merged_x = building_mods.connected_building_coords.map(coords => coords.x);
                building.merged_y = building_mods.connected_building_coords.map(coords => coords.y);
            }

            // filter the entrances to only include open ones
            let filtered_entrances = building.entrances.filter(function (door) {
                let door_mod = door_mods[door.id];
                return door_mod.open || (!door_mod.open && include_closed_doors_and_buildings);
            });
            building.entrances = filtered_entrances;

            // do not include buildings that have too few doors
            if (filtered_entrances.length < 2 && !include_few_doors_buildings) {
                continue;
            }

            filtered_graph.push(building);
        }
    }

    return filtered_graph;
}


// process a given building a set its grid information
function process_building(building, cell_info_override=null, skip_outline_calc=false) {

    // initialize the info object for the given building
    let cell_info = cell_info_override !== null ? cell_info_override : init_grid_cell_info(building);

    // make building available at connected cell coordinates
    setup_connected_grid_cell_info(cell_info);

    // update any coordinates of deep doors in the building (no longer needed as it's handled outline calculation)
    // update_deep_doors(building || cell_info.building_data);
    
    // create the building outline path 
    if (!skip_outline_calc) {
        create_building_outline_path(cell_info);
    }

    // calculate effective walls to prevent doors in corners
    find_building_effective_walls(cell_info);

    // update door positions to respect effective walls
    update_doors_to_effective_walls(cell_info);

    // find the bounding rectangle around the building outline shape
    find_building_bounding_rectangle(cell_info);

    // find building center point (considering the entire building)
    find_building_center(cell_info);

    // find building centers and adjacent walls of all connected buildings
    find_building_centers_and_adjacent_walls(cell_info);

    // find orientation of doors
    find_all_doors_orientations(cell_info);

    // calculate the corridors for the given building
    calculate_building_corridors(cell_info);
}


// link cell info building data available at the connected cell coordinates
function setup_connected_grid_cell_info(cell_info) {

    // TODO: this probably has further implications for other parts of the code

    let connected_buildings = cell_info.building_mods.connected_building_coords;
    if (connected_buildings == null) {
        return;
    }

    for (let i = 0; i < connected_buildings.length; i++) {
        let building_coords = grid_coords_for_building_or_door(connected_buildings[i]);
        grid[building_coords.y][building_coords.x] = cell_info;
    }
}


// calculate the length of a grid edge based on the config
function calc_grid_bounds(config) {
    let area = config["num_buildings"] / config["coverage"]
    let bounds = Math.ceil(Math.sqrt(area));
    return bounds;
}


// helper method to get the grid object at the provided coordinates
function grid_object_at_coords(grid_coords) {

    if (grid_coords.x >= grid.length || grid_coords.x < 0 || grid_coords.y >= grid.length || grid_coords.y < 0) {
        return null;
    }

    return grid[grid_coords.y][grid_coords.x];
}


// get the grid object for the provided building
function grid_object_for_id(building_id) {
    let building_grid_coords = grid_coords_for_building_id(building_id);
    return grid_object_at_coords(building_grid_coords);
}


// helper method to get the door object from stored data references
function door_object_for_id(cell_info, door_id) {
    let door_mods = cell_info.building_mods.entrance_mods;
    return door_mods[door_id]["data_ref"];
}


// returns an empty grid cell object
function new_empty_grid_cell() {
    let cell_info = {
        building_data: null,
        shapes: {
            building: null,
            building_outline: null,
            selection_overlay: null,
            entrances: {},
            editor_entrances: {},
            building_group: null,
            entrances_group: null,
            corridors_group: null
        },
        building_mods: {
            entrance_mods: {}, 
            open: true,
            orig_entrances: null,
            next_new_door_id: 1,
            outline_grid_path: [],
            outline_grid_walls: [],
            con_level: null,
            outline_grid_center: null,
            effective_grid_walls: [],
            normalized_grid_outline: [],
            normalized_bounding_rect: [],
            normal_offset: null,
            connected_building_coords: []
        }
    };

    return cell_info;
}


// returns a grid of objects describing every building cell for the graph
function create_empty_grid(length) {
    
    let new_grid = [];

    // iterate over every coordinate in the grid
    for (let y = 0; y < length; y++) {
        let row = [];
        for (let x = 0; x < length; x++) {

            // create empty object for each grid cell
                 
            let cell_info = new_empty_grid_cell();
            row.push(cell_info);
        }
        new_grid.push(row);
    }

    return new_grid;
}


// initialize the grid cell info for a given building
function init_grid_cell_info(building) {
    
    let doors = building.entrances;

    // get building x and y coordinates (convert 1-indexed to 0-indexed)
    let building_grid_coords = grid_coords_for_building_or_door(building);

    // get the grid cell info object associated with the building
    let cell_info = grid_object_at_coords(building_grid_coords);

    // add necessary info about the building cell to the grid array
    cell_info.building_data = building;
    cell_info.building_mods.open = true;
    cell_info.building_mods.outline_grid_path = [];
    cell_info.building_mods.outline_grid_walls = [];
    cell_info.building_mods.effective_grid_walls = [];
    cell_info.building_mods.entrance_mods = {};
    cell_info.building_mods.orig_entrances = building.entrances.map(a => {return {...a}});
    cell_info.building_mods.next_new_door_id = doors.length + 1;
    cell_info.building_mods.con_level = determine_con_level(building.congestion);
    cell_info.building_mods.corridor_all_grid_paths = [];
    cell_info.building_mods.corridor_center_lines = [];

    // iterate over every door in the building
    for (let d = 0; d < doors.length; d++) {
        let door = doors[d];
        let door_id = door["id"];

        cell_info.building_mods.entrance_mods[door_id] = {
            open: true,
            data_ref: door,
            last_drag_time: 0,
            wall_direction: "none",
            attached_wall: null,
            editor_highlighted: false,
            orientation: null,
            path_count: 0,
            corridor_path: []
        };
    }

    cell_info.building_mods.connection_mods = {};
    cell_info.building_mods.connection_mods[cell_info.building_data.id] = {
        center: null,
        outline_path: [],
        adjacent_walls: [],
        adjacent_cells: {}
    };

    // get coordinates for every merged building
    let connected_building_coords = [];

    if (cell_info.building_data.merged_x != null) {
        for (let i = 0; i < cell_info.building_data.merged_x.length; i++) {
            let coords = {
                x: cell_info.building_data.merged_x[i],
                y: cell_info.building_data.merged_y[i]
            };
            connected_building_coords.push(coords);

            let connected_building_id = grid_coords_to_building_id(grid_coords_for_building_or_door(coords));
            cell_info.building_mods.connection_mods[connected_building_id] = {
                center: null,
                outline_path: [],
                adjacent_walls: [],
                adjacent_cells: {}
            };
        }
    }

    cell_info.building_mods.connected_building_coords = connected_building_coords;

    return cell_info;
}


// merge two buildings together into one
function merge_buildings(cell_info1, cell_info2, orig_merge_coords, new_merge_coords) {

    if (cell_info1 === cell_info2 || cell_info1 === null || cell_info2 === null) {
        return;
    }

    let building1 = cell_info1.building_data;
    let building2 = cell_info2.building_data;

    let building_mods1 = cell_info1.building_mods;
    let building_mods2 = cell_info2.building_mods;

    let entrance_mods1 = building_mods1.entrance_mods;
    let entrance_mods2 = building_mods2.entrance_mods;

    let connection_mods1 = building_mods1.connection_mods;
    let connection_mods2 = building_mods2.connection_mods;

    // get list of entrances for both buildings
    let building1_doors = [];
    let building2_doors = [];

    for (let door_id in entrance_mods1) {
        building1_doors.push(entrance_mods1[door_id].data_ref);
    }
    for (let door_id in entrance_mods2) {
        building2_doors.push(entrance_mods2[door_id].data_ref);
    }

    // remove new connection from graph list
    let connection_graph_index = current_graph.indexOf(building2);
    if (connection_graph_index > -1) {
        current_graph.splice(connection_graph_index, 1); 
    }

    if (building1.merged_x == null) {
        building1.merged_x = [];
        building1.merged_y = [];
    }
    
    // add new connection to original building's merged coordinate list
    building1.merged_x.push(building2.x);
    building1.merged_y.push(building2.y);
    building_mods1.connected_building_coords.push({x: building2.x, y: building2.y});
    building_mods1.connected_building_coords = building_mods1.connected_building_coords.concat(building_mods2.connected_building_coords);
    for (let i = 0; i < building_mods2.connected_building_coords.length; i++) {
        let connected_connected_building_coords = building_mods2.connected_building_coords[i];
        building1.merged_x.push(connected_connected_building_coords.x);
        building1.merged_y.push(connected_connected_building_coords.y);
    }
    
    // combine connection mods for both buildings
    for (let building_id in connection_mods2) {
        connection_mods1[building_id] = connection_mods2[building_id];
    }

    // combine doors from both buildings
    let door_counter = 0;
    let new_doors = [];
    let new_door_mods = {};

    for (let orig_door_id in building_mods1.entrance_mods) {

        let door = building_mods1.entrance_mods[orig_door_id].data_ref;
        let new_door_id = ++door_counter
        
        door.id = new_door_id;
        new_doors.push(door);
        new_door_mods[new_door_id] = building_mods1.entrance_mods[orig_door_id];
    }

    for (let orig_door_id in building_mods2.entrance_mods) {

        let door = building_mods2.entrance_mods[orig_door_id].data_ref;
        let new_door_id = ++door_counter
        
        door.id = new_door_id;
        new_doors.push(door);
        new_door_mods[new_door_id] = building_mods2.entrance_mods[orig_door_id];
    }

    building1.entrances = new_doors;
    building_mods1.entrance_mods = new_door_mods;
    building_mods1.next_new_door_id = ++door_counter;
    
    // combine the outline paths of both buildings
    merge_building_outlines(cell_info1, cell_info2, orig_merge_coords, new_merge_coords);

    // reprocess the merged building for additional calculations (skipping outline calculation)
    process_building(null, cell_info1, true);
}


// merge the outlines of two buildings
function merge_building_outlines(cell_info1, cell_info2, orig_merge_coords, new_merge_coords) {

    let direction = coords_are_adjacent(orig_merge_coords, new_merge_coords);

    let building1_outline_path = cell_info1.building_mods.outline_grid_path;
    let building2_outline_path = cell_info2.building_mods.outline_grid_path;
    let building1_walls = cell_info1.building_mods.outline_grid_walls;
    let building2_walls = cell_info2.building_mods.outline_grid_walls;

    // get the grid line between the original and new building
    let split_line = null;

    if (direction === "up") {
        split_line = [
            {x: orig_merge_coords.x - 0.5, y: orig_merge_coords.y - 0.5},
            {x: orig_merge_coords.x + 0.5, y: orig_merge_coords.y - 0.5}
        ];
    } else if (direction === "down") {
        split_line = [
            {x: new_merge_coords.x - 0.5, y: new_merge_coords.y - 0.5},
            {x: new_merge_coords.x + 0.5, y: new_merge_coords.y - 0.5}
        ];
    } else if (direction === "left") {
        split_line = [
            {x: orig_merge_coords.x - 0.5, y: orig_merge_coords.y - 0.5},
            {x: orig_merge_coords.x - 0.5, y: orig_merge_coords.y + 0.5}
        ];
    } else if (direction === "right") {
        split_line = [
            {x: new_merge_coords.x - 0.5, y: new_merge_coords.y - 0.5},
            {x: new_merge_coords.x - 0.5, y: new_merge_coords.y + 0.5}
        ];
    }

    let split_orientation = calc_line_orthogonal_direction(split_line[0], split_line[1]);

    // find the closest wall to the split line for the original building
    let best_dist = Number.MAX_SAFE_INTEGER;
    let best_wall1 = null;

    for (let i = 0; i < building1_walls.length; i++) {
        let wall = building1_walls[i];
        let wall_orientation = calc_line_orthogonal_direction(wall[0], wall[1]);
        
        let estimated_building1 = estimate_building_grid_coords(wall[0]);
        let estimated_building2 = estimate_building_grid_coords(wall[1]);

        if (split_orientation !== wall_orientation || !coords_eq(estimated_building1, orig_merge_coords) || !coords_eq(estimated_building2, orig_merge_coords)) {
            continue;
        }

        let dist = calc_line_to_line_dist(wall, split_line);

        if (dist < best_dist) {
            best_dist = dist;
            best_wall1 = wall;
        }
    }

    // find the closest wall to the split line for the new building
    best_dist = Number.MAX_SAFE_INTEGER;
    let best_wall2 = null;

    for (let i = 0; i < building2_walls.length; i++) {
        let wall = building2_walls[i];
        let wall_orientation = calc_line_orthogonal_direction(wall[0], wall[1]);

        let estimated_building1 = estimate_building_grid_coords(wall[0]);
        let estimated_building2 = estimate_building_grid_coords(wall[1]);

        if (split_orientation !== wall_orientation || !coords_eq(estimated_building1, new_merge_coords) || !coords_eq(estimated_building2, new_merge_coords)) {
            continue;
        }

        let dist = calc_line_to_line_dist(wall, split_line);

        if (dist < best_dist) {
            best_dist = dist;
            best_wall2 = wall;
        }
    }

    console.log("best wall 1: ", best_wall1);
    console.log("best wall 2: ", best_wall2);
    console.log("orig merge coords: ", orig_merge_coords);
    console.log("new merge coords: ", new_merge_coords);
    console.log("direction: ", direction);
    console.log("split line: ", split_line, split_orientation);

    // find points halfway between the wall and the split line
    let best_wall1_proj = [calc_closest_point(split_line[0], split_line[1], best_wall1[0]), calc_closest_point(split_line[0], split_line[1], best_wall1[1])];
    let best_wall2_proj = [calc_closest_point(split_line[0], split_line[1], best_wall2[0]), calc_closest_point(split_line[0], split_line[1], best_wall2[1])];
    let best_wall1_proj_mid = [calc_weighted_midpoint(best_wall1[0], best_wall1_proj[0], 0.25), calc_weighted_midpoint(best_wall1[1], best_wall1_proj[1], 0.25)];
    let best_wall2_proj_mid = [calc_weighted_midpoint(best_wall2[0], best_wall2_proj[0], 0.25), calc_weighted_midpoint(best_wall2[1], best_wall2_proj[1], 0.25)];

    // store walls that will gap the split
    let split_gap_wall1 = [];
    let split_gap_wall2 = [];

    // determine direction to create split walls
    if (split_orientation === "vertical") {
        let diff1 = Math.abs(best_wall1_proj_mid[0].y - best_wall2_proj_mid[1].y);
        let diff2 = Math.abs(best_wall1_proj_mid[1].y - best_wall2_proj_mid[0].y);

        let split_gap_wall1_offset1 = 0;
        let split_gap_wall1_offset2 = 0;
        let split_gap_wall2_offset1 = 0;
        let split_gap_wall2_offset2 = 0;

        if (best_wall1_proj_mid[0].y < best_wall2_proj_mid[1].y) {
            split_gap_wall1_offset1 = diff1/2;
            split_gap_wall1_offset2 = -diff1/2;

        } else {
            split_gap_wall1_offset1 = -diff1/2;
            split_gap_wall1_offset2 = diff1/2;
        }

        if (best_wall1_proj_mid[1].y < best_wall2_proj_mid[0].y) {
            split_gap_wall2_offset1 = diff2/2;
            split_gap_wall2_offset2 = -diff2/2;
        } else {
            split_gap_wall2_offset1 = -diff2/2;
            split_gap_wall2_offset2 = diff2/2;
        }

        split_gap_wall1 = [{
                x: best_wall1_proj_mid[0].x,
                y: best_wall1_proj_mid[0].y + split_gap_wall1_offset1
            }, {
                x: best_wall2_proj_mid[1].x,
                y: best_wall2_proj_mid[1].y + split_gap_wall1_offset2
            }
        ];
        split_gap_wall2 = [{
                x: best_wall1_proj_mid[1].x,
                y: best_wall1_proj_mid[1].y + split_gap_wall2_offset1
            }, {
                x: best_wall2_proj_mid[0].x,
                y: best_wall2_proj_mid[0].y + split_gap_wall2_offset2
            }
        ];

    } else {
        let diff1 = Math.abs(best_wall1_proj_mid[0].x - best_wall2_proj_mid[1].x);
        let diff2 = Math.abs(best_wall1_proj_mid[1].x - best_wall2_proj_mid[0].x);
        
        let split_gap_wall1_offset1 = 0;
        let split_gap_wall1_offset2 = 0;
        let split_gap_wall2_offset1 = 0;
        let split_gap_wall2_offset2 = 0;

        if (best_wall1_proj_mid[0].x < best_wall2_proj_mid[1].x) {
            split_gap_wall1_offset1 = diff1/2;
            split_gap_wall1_offset2 = -diff1/2;

        } else {
            split_gap_wall1_offset1 = -diff1/2;
            split_gap_wall1_offset2 = diff1/2;
        }

        if (best_wall1_proj_mid[1].x < best_wall2_proj_mid[0].x) {
            split_gap_wall2_offset1 = diff2/2;
            split_gap_wall2_offset2 = -diff2/2;
        } else {
            split_gap_wall2_offset1 = -diff2/2;
            split_gap_wall2_offset2 = diff2/2;
        }

        split_gap_wall1 = [{
                x: best_wall1_proj_mid[0].x + split_gap_wall1_offset1,
                y: best_wall1_proj_mid[0].y 
            }, {
                x: best_wall2_proj_mid[1].x + split_gap_wall1_offset2,
                y: best_wall2_proj_mid[1].y 
            }
        ];
        split_gap_wall2 = [{
                x: best_wall1_proj_mid[1].x + split_gap_wall2_offset1,
                y: best_wall1_proj_mid[1].y 
            }, {
                x: best_wall2_proj_mid[0].x + split_gap_wall2_offset2,
                y: best_wall2_proj_mid[0].y 
            }
        ];
    }
    split_gap_wall2.reverse();

    // construct the combined path
    let new_outline_path = [...building1_outline_path];

    let best_wall1_index = building1_walls.indexOf(best_wall1);
    let best_wall2_index = building2_walls.indexOf(best_wall2);

    // ensure building 2 outline path is in proper order for drawing
    rotate_array(building2_outline_path, -best_wall2_index-1);

    // combine all path parts together
    new_outline_path.splice(best_wall1_index + 1, 0, 
        best_wall1_proj_mid[0], 
        ...split_gap_wall1,
        best_wall2_proj_mid[1], 
        ...building2_outline_path, 
        best_wall2_proj_mid[0],
        ...split_gap_wall2,
        best_wall1_proj_mid[1]
    );
    new_outline_path = simplify_path(new_outline_path, true);

    // set building1's outline
    cell_info1.building_mods.outline_grid_path = new_outline_path;
    cell_info1.building_mods.outline_grid_walls = lines_from_path(new_outline_path, true);
}


// get list of all doors for a given building
function get_all_doors(cell_info) {

    let entrance_mods = cell_info.building_mods.entrance_mods;
    let doors = [];

    for (let door_id in entrance_mods) {
        doors.push(entrance_mods[door_id].data_ref);
    }

    // ensure they are sorted by id
    doors.sort((a, b) => a.id - b.id);

    return doors;
}


// check if the building at the given id is adjacently connected to the other id
function check_building_connected_adjacency(building_id, adjacent_id) {

    let cell_info = grid_object_for_id(building_id);

    if (cell_info.building_data === null) {
        return false;
    }

    return adjacent_id in cell_info.building_mods.connection_mods[building_id].adjacent_cells;
}


/* ----------------------------- path management ---------------------------- */


// process returned path recommendation results
function process_paths(paths) {
    current_paths = paths;

    console.log("returned paths", paths);

    // reset the path mods 
    path_mods = {};
    path_algs.forEach((alg) => {
        let path_mod = {
            display_active: true,
            has_data: alg in paths,
            data_ref: alg in paths ? paths[alg] : null,
            shape: null
        };
        path_mods[alg] = path_mod
    });

    // draw paths and update sidebar info
    update_path_legend_active_paths();
    update_path_stats_tables();

    // automatically open the path stats and legend sections
    if (auto_open_sections_enabled) {
        set_accordion_opened("building-editor-accordion-button", false);
        set_accordion_opened("path-legend-accordion-button", true);
        set_accordion_opened("path-stats-accordion-button", true);
    }

    // count the number of paths that enter or exit each door
    count_paths_through_doors();

    // draw the paths on the main stage
    draw_paths();
}


// count the number of paths that enter or exit each door
function count_paths_through_doors() {

    // reset the count for each door
    for (let y = 0; y < grid.length; y++) {
        for (let x = 0; x < grid.length; x++) {
            let cell_info = grid_object_at_coords({x:x, y:y});

            // iterate over every door
            for (let door_id in cell_info.building_mods.entrance_mods) {
                cell_info.building_mods.entrance_mods[door_id].path_count = 0;
            }
        }
    }
    
    // iterate over every current path
    for (let a = 0; a < path_algs.length; a++) {

        let alg = path_algs[a];
        let path_obj = current_paths[alg];
        let path_mod = path_mods[alg];

        // do not try to display paths that are not present
        if (!path_mod.has_data) {
            console.log("no data for path: ", alg);
            continue;
        }

        // iterate over every building in the path
        for (let i = 1; i < path_obj.path.length - 2; i++) {

            let building = path_obj.path[i];
            let door_id = building.entrances[0].id;

            let cell_info = grid_object_for_id(building.id);

            if (cell_info !== null) {
                // increase the path counter for the given door
                cell_info.building_mods.entrance_mods[door_id].path_count++;
            }
        }
    }
}


// handle a path or end point being selected
function select_path_endpoint(grid_coords, is_start) {

    // set the new selected grid coords
    if (is_start) {
        path_start_selected_grid_coords = grid_coords;
    
    // set the new selected grid coords
    } else {
        path_end_selected_grid_coords = grid_coords;
    }

    draw_point_selection(grid_coords, selection_layer, is_start);

    // after selection is made, neither selection type should be active
    is_selecting_path_start = false;
    is_selecting_path_end = false;

    // update the path options display
    update_path_select_labels();
    update_path_select_buttons_active();
}


// initialize the path mods data structure
function init_path_mods() {
    path_mods = {};
    path_algs.forEach((alg) => {
        let path_mod = {
            display_active: true,
            has_data: false,
            data_ref: null,
            shape: null
        };
        path_mods[alg] = path_mod
    });
}


/* ---------------------- building selection management --------------------- */


// handler for when a point has been clicked on the main stage
function select_point() {
    
    // get the stage coords of the current pointer position
    let scale = main_stage.scaleX();
    let pointer = main_stage.getPointerPosition();
    let stage_coords = {
        x: (pointer.x - main_stage.x()) / scale,
        y: (pointer.y - main_stage.y()) / scale,
    };
    console.log("click detected at stage coords: ", stage_coords);

    // convert the stage coords of the click to door grid coords
    let grid_coords = door_main_stage_coords_to_grid_coords_rounding(stage_coords);

    // determine the selection to make based on the current system state
    if (is_selecting_path_start) {
        select_path_endpoint(grid_coords.door, true);
    } else if (is_selecting_path_end) {
        select_path_endpoint(grid_coords.door, false);
    } else if (is_selecting_new_connection) {
        select_new_building_connection(grid_coords.building);
    } else {
        select_building_to_edit(grid_coords.building, true, true);
    }
}


// reset currently selecting statuses
function reset_currently_selecting_status() {

    is_selecting_path_start = false;
    is_selecting_path_end = false;
    is_selecting_new_connection = false;

    update_path_select_buttons_active();
    update_new_connection_button_active();
}


// reset all selected variables
function reset_cell_selections(reset_endpoints, reset_editor) {
    
    if (reset_endpoints) {
        path_start_selected_grid_coords = null;
        path_end_selected_grid_coords = null;

        update_path_select_buttons_active();
        update_path_select_labels();    
    }

    if (reset_editor) {
        editor_selected_cell_info = null;
        new_connection_start_cell_info = null;
    
        is_selecting_path_start = false;
        is_selecting_path_end = false;
        is_selecting_new_connection = false;
    
        update_new_connection_button_active();
    }
}

// handle a new building being selected to connect to
function select_new_building_connection(connection_grid_coords) {

    let connection_cell_info = grid_object_at_coords(connection_grid_coords);
    let main_building_grid_coords = grid_coords_for_building_or_door(new_connection_start_cell_info.building_data);
    let all_main_coords = [main_building_grid_coords, ...new_connection_start_cell_info.building_mods.connected_building_coords.map(coords => grid_coords_for_building_or_door(coords))];
    let orig_merge_coords = null;

    for (let i = 0; i < all_main_coords.length; i++) {
        let coords = all_main_coords[i];
        if (coords_are_adjacent(connection_grid_coords, coords)) {
            orig_merge_coords = coords;
        }
    }

    // check cases in which to not connect
    if (connection_cell_info === null) {
        console.log("selected building to connect to is outside grid bounds");
        return;
    } else if (connection_cell_info === new_connection_start_cell_info) {
        console.log("selected building to connect to is the current building");
        return;
    } else if (orig_merge_coords === null) {
        console.log("can only merge with adjacent buildings");
        return;
    }

    if (connection_cell_info.building_data === null) {
        // TODO: create new building if connecting to empty cell?
        return;
    }

    console.log("combining with building: ", connection_grid_coords);

    // remove selected building shape from main stage
    connection_cell_info.shapes.building_group.destroy();

    // merge buildings together
    merge_buildings(new_connection_start_cell_info, connection_cell_info, orig_merge_coords, connection_grid_coords);

    // reset building editor
    reset_building_editor(true);

    // reselect building
    select_building_to_edit(main_building_grid_coords, false, true);

    // redraw new merged building
    redraw_selected_building(new_connection_start_cell_info);

    // reset connection button
    is_selecting_new_connection = false;
    new_connection_start_cell_info = null;
    update_path_select_buttons_active();
    update_new_connection_button_active();

    // redraw roads 
    draw_roads(road_layer);
}


/* ---------------------- road management --------------------------- */


// generates random road widths for the given grid size
function generate_random_road_weights() {
    horz_roads_rand_weights = [];
    vert_roads_rand_weights = [];

    for (let i = 0; i < grid.length + 1; i++) {
        horz_roads_rand_weights.push(rand_in_range(road_rand_weight_min, road_rand_weight_max));
        vert_roads_rand_weights.push(rand_in_range(road_rand_weight_min, road_rand_weight_max));
    }
}