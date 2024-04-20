
/* -------------------------------------------------------------------------- */
/*                           coordinate conversions                           */
/* -------------------------------------------------------------------------- */


// convert grid coordinates to stage cell coordinates based on the provided dimensions
function grid_coords_to_main_stage_coords(grid_coords) {
    return {
        x: grid_coords.x * (main_cell_dims.size + main_cell_dims.spacing),
        y: grid_coords.y * (main_cell_dims.size + main_cell_dims.spacing)
    };
}


// convert main stage coords to grid coords
function main_stage_coords_to_grid_coords(stage_coords) {
    return {
        x: stage_coords.x / (main_cell_dims.size + main_cell_dims.spacing),
        y: stage_coords.y / (main_cell_dims.size + main_cell_dims.spacing)
    };
}


// convert door grid coordinates to stage coordinates based on the provided dimensions
function door_grid_coords_to_stage_coords(door_grid_coords, building_grid_coords, for_main_stage) {

    if (for_main_stage) {
        return door_grid_coords_to_main_stage_coords(door_grid_coords, building_grid_coords);
    } else {
        let cell_info = grid_object_at_coords(building_grid_coords);
        let building_mods = cell_info.building_mods;
        let normalized_door_grid_coords = {
            x: door_grid_coords.x - building_mods.normal_offset.x,
            y: door_grid_coords.y - building_mods.normal_offset.y
        };
        return door_grid_coords_to_editor_stage_coords(normalized_door_grid_coords, building_mods.normalized_bounding_rect);
    }
}


// convert door grid coordinates to main stage coordinates
function door_grid_coords_to_main_stage_coords(door_grid_coords, building_grid_coords, should_estimate_coords=false) {

    if (should_estimate_coords) {
        building_grid_coords = estimate_building_grid_coords(door_grid_coords);
    }

    let building_stage_coords = grid_coords_to_main_stage_coords(building_grid_coords);
    let cell_dims = get_cell_dims(true);

    let invert_y = should_invert_door_y ? -1 : 1;
    
    // extract the door's offset from the building to properly scale to cell size
    let door_grid_coord_offset = {
        x: door_grid_coords.x - building_grid_coords.x,
        y: invert_y * (door_grid_coords.y - building_grid_coords.y) // * -1 to invert y coordinate system
    };

    // get final door coordinates by scaling and translating
    return {
        x: building_stage_coords.x + (door_grid_coord_offset.x * cell_dims.size) + (cell_dims.size / 2), // +size/2 to get cell center coordinates rather than top left (used in rect positioning)
        y: building_stage_coords.y + (door_grid_coord_offset.y * cell_dims.size) + (cell_dims.size / 2),
    };
}


// convert door grid coordinates to editor stage coordinates
function door_grid_coords_to_editor_stage_coords(normalized_door_grid_coords, building_bounding_grid_rect) {

    let cell_dims = get_cell_dims(false);

    let bounds_width = calc_dist(building_bounding_grid_rect[0], building_bounding_grid_rect[1]);
    let bounds_height = calc_dist(building_bounding_grid_rect[1], building_bounding_grid_rect[2]);

    let editor_inset = cell_dims.size * editor_inset_ratio;
    let scale = Math.min(cell_dims.size / bounds_width, cell_dims.size / bounds_height);

    let x_offset = editor_inset + ((cell_dims.size - bounds_width*scale) / 2) - (building_bounding_grid_rect[0].x * scale);
    let y_offset = editor_inset + ((cell_dims.size - bounds_height*scale) / 2) - (building_bounding_grid_rect[0].y * scale); 

    return {
        x: normalized_door_grid_coords.x * scale + x_offset,
        y: normalized_door_grid_coords.y * scale + y_offset
    };
}


// normalize a list of door coordinates as if they started in 0, 0
function normalize_door_grid_coords_list(door_grid_coords_list) {

    let best_left_door = {x: Number.MAX_SAFE_INTEGER, y: Number.MAX_SAFE_INTEGER};
    let best_up_door = {x: Number.MAX_SAFE_INTEGER, y: Number.MAX_SAFE_INTEGER};

    for (let i = 0; i < door_grid_coords_list.length; i++) {
        let curr_door = door_grid_coords_list[i];

        if (curr_door.x < best_left_door.x) {
            best_left_door = curr_door;
        }

        if (curr_door.y < best_up_door.y) {
            best_up_door = curr_door;
        }
    }

    let left_building_coords = estimate_building_grid_coords(best_left_door);
    let up_building_coords = estimate_building_grid_coords(best_up_door);

    let normalized_doors = door_grid_coords_list.map(function (door) {
        return {
            x: door.x - left_building_coords.x,
            y: door.y - up_building_coords.y
        };
    });

    return {
        door_coords: normalized_doors,
        normal_offset: {
            x: left_building_coords.x,
            y: up_building_coords.y
        }
    };
}


// get the building coords for given door coords by rounding
function estimate_building_grid_coords(door_grid_coords) {
    return {
        x: Math.round(door_grid_coords.x),
        y: Math.round(door_grid_coords.y)
    };
}


// convert door grid coords to main stage coords by rounding to get the building coords
function door_grid_coords_to_main_stage_coords_rounding(door_grid_coords) {

    let building_grid_coords = estimate_building_grid_coords(door_grid_coords);
    return door_grid_coords_to_stage_coords(door_grid_coords, building_grid_coords, true);
}


// convert door main stage coords to grid coords by rounding to get the building coords
function door_main_stage_coords_to_grid_coords_rounding(door_stage_coords) {

    // ugly but hey it works

    let cell_dims = get_cell_dims(true);
    let resolution = cell_dims.size + cell_dims.spacing;
    let building_stage_coords = {
        x: round_partial(door_stage_coords.x - (cell_dims.size + cell_dims.spacing/2) / 2, resolution),
        y: round_partial(door_stage_coords.y - (cell_dims.size + cell_dims.spacing/2) / 2, resolution)
    };
    let building_grid_coords = main_stage_coords_to_grid_coords(building_stage_coords);
    building_grid_coords = {
        x: Math.round(building_grid_coords.x),
        y: Math.round(building_grid_coords.y)
    };

    return {
        door: door_stage_coords_to_grid_coords(door_stage_coords, building_grid_coords, true),
        building: building_grid_coords
    };
}


// convert door main stage coords to grid coords
function door_main_stage_coords_to_grid_coords(door_stage_coords, building_grid_coords) {
    let building_stage_coords = grid_coords_to_main_stage_coords(building_grid_coords);
    let cell_dims = get_cell_dims(true);

    let invert_y = should_invert_door_y ? -1 : 1;

    // unscale and untranslate the stage coords to get the offset of the door to the building
    let door_grid_coord_offset = {
        x: (door_stage_coords.x - building_stage_coords.x - (cell_dims.size / 2)) / cell_dims.size,
        y: (door_stage_coords.y - building_stage_coords.y - (cell_dims.size / 2)) / cell_dims.size,
    };

    // get the door grid coords by adding the offset to the building coords
    return {
        x: building_grid_coords.x + door_grid_coord_offset.x,
        y: building_grid_coords.y + (invert_y * door_grid_coord_offset.y)
    };
}


// convert door editor stage coords to grid coords
function door_editor_stage_coords_to_grid_coords(door_stage_coords, building_grid_coords) {
    
    let cell_dims = get_cell_dims(false);
    let cell_info = grid_object_at_coords(building_grid_coords);
    let building_bounding_grid_rect = cell_info.building_mods.normalized_bounding_rect;
    let normal_offset = cell_info.building_mods.normal_offset;

    let bounds_width = calc_dist(building_bounding_grid_rect[0], building_bounding_grid_rect[1]);
    let bounds_height = calc_dist(building_bounding_grid_rect[1], building_bounding_grid_rect[2]);
    let editor_inset = cell_dims.size * editor_inset_ratio;

    let scale = Math.min(cell_dims.size / bounds_width, cell_dims.size / bounds_height);

    let x_offset = editor_inset + ((cell_dims.size - bounds_width*scale) / 2) - (building_bounding_grid_rect[0].x * scale);
    let y_offset = editor_inset + ((cell_dims.size - bounds_height*scale) / 2) - (building_bounding_grid_rect[0].y * scale);
    
    return {
        x: (door_stage_coords.x - x_offset) / scale + normal_offset.x,
        y: (door_stage_coords.y - y_offset) / scale + normal_offset.y
    };
}


// convert door grid coordinates to stage coordinates based on the provided dimensions
function door_stage_coords_to_grid_coords(door_stage_coords, building_grid_coords, for_main_stage) {

    if (for_main_stage) {
        return door_main_stage_coords_to_grid_coords(door_stage_coords, building_grid_coords);
    } else {
        return door_editor_stage_coords_to_grid_coords(door_stage_coords, building_grid_coords);
    }
}


// helper method to get the grid coordinates for a given building id
function grid_coords_for_building_id(building_id) {
    return {
        x: Math.floor(building_id / grid.length),
        y: building_id % grid.length
    };
}


// helper method to get the building id for a given set of coordinates
function grid_coords_to_building_id(grid_coords) {
    return grid_coords.x * grid.length + grid_coords.y;
}


// helper function to get a grid cell ID based on coordinates
function grid_cell_id_for_coords(grid_coords) {
    return grid_coords.x * grid.length + grid_coords.y;
}


// helper method to get the grid coordinates for a given building or door object
function grid_coords_for_building_or_door(bod) {

    // converts 1-indexed coordinates to 0-indexed
    return {
        x: bod.x - 1,
        y: bod.y - 1
    };
}


// helper method to get the grid coordinates for a given building or door object
function building_or_door_coords_for_grid_coords(grid_coords) {

    // converts 0-indexed coordinates to 1-indexed
    return {
        x: grid_coords.x + 1,
        y: grid_coords.y + 1
    };
}


/* -------------------------------------------------------------------------- */
/*                       building coordinate processing                       */
/* -------------------------------------------------------------------------- */


// modifies door positions for a given building such that no door is deeper than it's two adjacent doors
// a "deep" door is one where it's x or y coordinate is lower than both adjacent doors' x or y coordinates respectively
function update_deep_doors(building) {

    // let building = cell_info.building_data;
    let doors = building.entrances;

    // does not apply to buildings with three or less doors
    if (doors.length <= 3) {
        return
    }

    // iterate over every door
    for (let d = 0; d < doors.length; d++) {

        // find the door and its two neighbors
        let neighbor1 = doors[d];
        let target = doors[(d + 1) % doors.length];
        let neighbor2 = doors[(d + 2) % doors.length];

        let deep_status = check_deep_door(neighbor1, target, neighbor2, building);

        // found deep door in on left side of building
        if (deep_status === "left") {
            target.x = neighbor1.x > neighbor2.x ? neighbor1.x : neighbor2.x;
        } 
        
        // found deep door on right side of building
        if (deep_status === "right") {
            target.x = neighbor1.x < neighbor2.x ? neighbor1.x : neighbor2.x;
        } 
        
        // found deep door on top of building
        if (deep_status === "up") {
            target.y = neighbor1.y < neighbor2.y ? neighbor1.y : neighbor2.y;
        } 
        
        // found deep door on bottom of building
        if (deep_status === "down") {
            target.y = neighbor1.y > neighbor2.y ? neighbor1.y : neighbor2.y;
        }
    }
}


// check if target door is deep between three points
function check_deep_door(neighbor1, target, neighbor2, reference) {
    
    // found deep door in on left side of building
    if (target.x < reference.x && target.x > neighbor1.x && target.x > neighbor2.x) {
        return "left";
    } 
    
    // found deep door on right side of building
    if (target.x > reference.x && target.x < neighbor1.x && target.x < neighbor2.x) {
        return "right";
    } 
    
    // found deep door on top of building
    if (target.y > reference.y && target.y < neighbor1.y && target.y < neighbor2.y) {
        return "up";
    } 
    
    // found deep door on bottom of building
    if (target.y < reference.y && target.y > neighbor1.y && target.y > neighbor2.y) {
        return "down";
    }

    return null;
}


// creates the building outline grid path for the building at the given coordinates
function create_building_outline_path(cell_info) {

    // get list of doors based on door mods (in case of closed doors being removed from main list)
    let doors = [];
    for (let door_id in cell_info.building_mods.entrance_mods) {
        doors.push(cell_info.building_mods.entrance_mods[door_id].data_ref);
    }
    doors.sort((a, b) => a.id - b.id);
    // doors = sort_points_for_convex_polygon(doors).reverse();

    // store coordinates to draw building shape
    let grid_shape_path = [];

    let updating_2nd_deep_half = false;

    // iterate over every sequential pairs of doors
    for (let d = 0; d < doors.length; d++) {

        let door1 = doors[d];
        let door2 = doors[(d + 1) % doors.length];

        // get the deep status of the next
        let door2_deep_status = doors.length > 3 ? check_deep_door(door1, door2, doors[(d + 2) % doors.length], cell_info.building_data) : null;
        
        // get door x and y coordinates (convert 1-indexed to 0-indexed)
        let door1_grid_coords = grid_coords_for_building_or_door(door1);
        let door2_grid_coords = grid_coords_for_building_or_door(door2);

        // find the corner or corner cutout for the next door
        if (door2_deep_status !== null || updating_2nd_deep_half) {
            let corner_path = calc_cutout_corner_between_points(door1_grid_coords, door2_grid_coords, true, 0.5);
            grid_shape_path.push(door1_grid_coords, ...corner_path);

            if (door2_deep_status !== null) {
                updating_2nd_deep_half = true;
            } else if (updating_2nd_deep_half) {
                updating_2nd_deep_half = false;
            }

        } else {
            let corner = calc_corner_between_points(door1_grid_coords, door2_grid_coords, true, false);
            grid_shape_path.push(door1_grid_coords, corner);
        }
    }

    // simplify the grid path by removing duplicate points and points on the same line
    simplified_grid_path = simplify_path(grid_shape_path, true, 0.0001);

    // save the path to the cell_info
    cell_info.building_mods.outline_grid_path = simplified_grid_path;
    cell_info.building_mods.outline_grid_walls = lines_from_path(simplified_grid_path, true);
}


// calculates the building's effective wall grid lines (prevents doors from being positioned in corners)
function find_building_effective_walls(cell_info) {

    let grid_walls = cell_info.building_mods.outline_grid_walls;

    // calculate the usable wall lines for door placement
    let effective_grid_walls = [];

    for (let i = 0; i < grid_walls.length; i++) {

        let wall = grid_walls[i];
        let p1 = wall[0];
        let p2 = wall[1];

        let line_len = calc_dist(p1, p2);

        // do not use walls that are less than the length of a door
        if (line_len < door_len_ratio) {
            continue;
        }

        // translate points of the wall 1/2 the door length and stroke sizes ratios inwards to prevent doors in corners
        let new_p1 = calc_point_translation(p1, p1, p2, (door_len_ratio + building_stroke_size_ratio + door_stroke_size_ratio) / 2); 
        let new_p2 = calc_point_translation(p2, p2, p1, (door_len_ratio + building_stroke_size_ratio + door_stroke_size_ratio) / 2);

        let line = [new_p1, new_p2];
        effective_grid_walls.push(line);
    }

    cell_info.building_mods.effective_grid_walls = effective_grid_walls;
}


// find the bounding rectangle for a building
function find_building_bounding_rectangle(cell_info) {

    let grid_shape_path = cell_info.building_mods.outline_grid_path;
    // let entrance_points = grid_shape_path.map((door) => grid_coords_for_building_or_door(door));
    let normalized_data = normalize_door_grid_coords_list(grid_shape_path);
    let bounding_rect = calc_bounding_rect(normalized_data.door_coords);

    cell_info.building_mods.normalized_bounding_rect = bounding_rect;
    cell_info.building_mods.normalized_grid_outline = normalized_data.door_coords;
    cell_info.building_mods.normal_offset = normalized_data.normal_offset;
}


// updates all door coordinates for a building to the effective walls
function update_doors_to_effective_walls(cell_info) {
    
    let doors = cell_info.building_data.entrances;
    let door_mods = cell_info.building_mods.entrance_mods;
    let effective_walls = cell_info.building_mods.effective_grid_walls;

    // don't update door positions if there are no walls
    if (effective_walls.length === 0) {
        return;
    }

    // iterate over every door
    for (let door_id in door_mods) {

        let door_mod = door_mods[door_id];
        let door = door_mod.data_ref;

        // get the grid coordinate for the door (converts 1-indexed to 0-indexed)
        let door_grid_coords = grid_coords_for_building_or_door(door);

        // get the closest wall location to the current location
        let best_point_and_line = calc_closest_line_and_point_from_point_to_lines(effective_walls, door_grid_coords);
        let line_direction = calc_line_orthogonal_direction(best_point_and_line.line[0], best_point_and_line.line[1]);
        door_mod.wall_direction = line_direction;
        door_mod.attached_wall = best_point_and_line.line;

        // set door's new coordinates (and convert index back to 1-indexed)
        door.x = best_point_and_line.point.x + 1;
        door.y = best_point_and_line.point.y + 1;
    }
}


// find the center coordinate of the building shape
function find_building_center(cell_info) {

    let outline_grid_path = cell_info.building_mods.outline_grid_path;

    // convert the outline grid path to the input needed by polylabel and then find its center point
    let polylabel_polygon = outline_grid_path.map((p) => [p.x, p.y]);
    let center = polylabel([polylabel_polygon]);
    
    cell_info.building_mods.outline_grid_center = {x: center[0], y: center[1]};
}


// find the center point of all connected buildings
function find_building_centers_and_adjacent_walls(cell_info) {

    let building_mods = cell_info.building_mods;
    let door_mods = building_mods.entrance_mods;
    let connection_mods = building_mods.connection_mods;
    let outline_grid_path = building_mods.outline_grid_path;

    // store a modified outline grid path that includes extra points when intersections are found
    let outline_grid_path_with_splits = outline_grid_path.slice();
    let outline_splits_added = [];

    // helper function to add new split points to the outline grid paht
    function add_outline_split_points(intersection, outline_index, direction) {

        if (outline_splits_added.indexOf(outline_index) > -1) {
            return;
        }
        
        let point1 = outline_grid_path[outline_index]
        let point2 = outline_grid_path[(outline_index+1)%outline_grid_path.length];
        
        let point1_to_split = calc_line_extend_point(point1, intersection, -0.025);
        let point2_to_split = calc_line_extend_point(point2, intersection, -0.025);
        
        let split_index = outline_grid_path_with_splits.indexOf(point1);

        outline_grid_path_with_splits.splice(split_index + 1, 0, point1_to_split, point2_to_split);
        outline_splits_added.push(outline_index);
    }

    // get grid coords for all connected buildings
    let connected_grid_coords = [cell_info.building_data, ...building_mods.connected_building_coords].map(coords => grid_coords_for_building_or_door(coords));
    
    // this is so inefficient...

    // iterate over every connected grid coord
    for (let i = 0; i < connected_grid_coords.length && connected_grid_coords.length > 1; i++) {
        
        let coords = connected_grid_coords[i];
        let building_id = grid_coords_to_building_id(coords);
        let connection_mod = connection_mods[building_id];

        // reset outline path
        connection_mod.outline_path = [];

        // get door grid coordinates representing the bounds of the grid cell
        let left_bounds     = [{x:coords.x-0.5, y:coords.y-0.5}, {x:coords.x-0.5, y:coords.y+0.5}];
        let down_bounds     = [{x:coords.x-0.5, y:coords.y+0.5}, {x:coords.x+0.5, y:coords.y+0.5}];
        let right_bounds    = [{x:coords.x+0.5, y:coords.y+0.5}, {x:coords.x+0.5, y:coords.y-0.5}];
        let up_bounds       = [{x:coords.x+0.5, y:coords.y-0.5}, {x:coords.x-0.5, y:coords.y-0.5}];

        let left_id = grid_coords_to_building_id({x:coords.x-1, y:coords.y});
        let right_id = grid_coords_to_building_id({x:coords.x+1, y:coords.y});
        let up_id = grid_coords_to_building_id({x:coords.x, y:coords.y-1});
        let down_id = grid_coords_to_building_id({x:coords.x, y:coords.y+1});

        let left_intersections = [];
        let down_intersections = [];
        let right_intersections = [];
        let up_intersections = [];

        // iterate over every wall in the outline path
        let outline_grid_path = cell_info.building_mods.outline_grid_path;
        for (let j = 0; j < outline_grid_path.length; j++) {

            let wall = [outline_grid_path[j], outline_grid_path[(j+1)%outline_grid_path.length]];

            // find intersections of grid cell bounds and building outline
            let left_intersection = calc_lines_intersection(left_bounds, wall);
            let down_intersection = calc_lines_intersection(down_bounds, wall);
            let right_intersection = calc_lines_intersection(right_bounds, wall);
            let up_intersection = calc_lines_intersection(up_bounds, wall);

            if (left_intersection !== null) {
                left_intersections.push(left_intersection);
                add_outline_split_points(left_intersection, j, "left");
            }
            if (down_intersection !== null) {
                down_intersections.push(down_intersection);
                add_outline_split_points(down_intersection, j, "down");
            }
            if (right_intersection !== null) {
                right_intersections.push(right_intersection);
                add_outline_split_points(right_intersection, j, "right");
            }
            if (up_intersection !== null) {
                up_intersections.push(up_intersection);
                add_outline_split_points(up_intersection, j, "up");
            }
        }

        // only add intersections if they were found
        if (left_intersections.length > 0) {
            connection_mod.adjacent_walls.push(left_intersections);
            connection_mod.adjacent_cells[left_id] = {
                wall: left_intersections,
                path_to_wall: null
            };
        }
        if (down_intersections.length > 0) {
            connection_mod.adjacent_walls.push(down_intersections);
            connection_mod.adjacent_cells[down_id] = {
                wall: down_intersections,
                path_to_wall: null
            };
        }
        if (right_intersections.length > 0) {
            connection_mod.adjacent_walls.push(right_intersections);
            connection_mod.adjacent_cells[right_id] = {
                wall: right_intersections,
                path_to_wall: null
            };
        }
        if (up_intersections.length > 0) {
            connection_mod.adjacent_walls.push(up_intersections);
            connection_mod.adjacent_cells[up_id] = {
                wall: up_intersections,
                path_to_wall: null
            };
        }
    }

    // get outline grid path parts associated with each building
    for (let i = 0; i < outline_grid_path_with_splits.length; i++) {
        let coords = outline_grid_path_with_splits[i];

        let estimated_building_grid_coords = estimate_building_grid_coords(coords);
        let estimated_building_id = grid_coords_to_building_id(estimated_building_grid_coords);

        if (estimated_building_id in connection_mods) {
            connection_mods[estimated_building_id].outline_path.push(coords);
        }
    }

    // get the center for each connected building
    for (let building_id in connection_mods) {
        let connection_mod = connection_mods[building_id];

        let center = null;

        // try to use polylabel to find decent center point
        try {
            let poly_center = polylabel([connection_mod.outline_path.map(coord => [coord.x, coord.y])]);        
            center= {x: poly_center[0], y: poly_center[1]};
        } catch(e) {
            console.log(e);
            console.log("failed cell_info: ", cell_info);
            console.log("center attempt for path: ", [connection_mod.outline_path.map(coord => [coord.x, coord.y])]);

            // backup is to average points to get the center
            center = calc_avg_point(connection_mod.outline_path);
        }
        connection_mod.center = center;
    }

    building_mods.outline_grid_path_with_splits = outline_grid_path_with_splits;
}


// calculate building corridors
function calculate_building_corridors(cell_info) {

    let building_mods = cell_info.building_mods;
    let connection_mods = building_mods.connection_mods;
    let door_mods = building_mods.entrance_mods;

    let all_corridor_paths = [];

    // define all lines connecting centers
    let center_lines = [];

    // iterate over every connected building cell for the given building
    for (let building_id in connection_mods) {

        let building_grid_coords = grid_coords_for_building_id(building_id);
        let connection_mod = connection_mods[building_id];
        let center = connection_mod.center;

        // define a "line" that is just the center point as to include it for single cell buildings
        if (Object.keys(connection_mod.adjacent_cells).length === 0) {
            center_lines.push([center, center]);
        } else {

            // iterate over every adjacent building
            for (let adjacent_building_id in connection_mod.adjacent_cells) {
                let adjacent_info = connection_mod.adjacent_cells[adjacent_building_id];
                
                // get the target point on the current wall
                let wall = adjacent_info.wall;
                let wall_midpoint = calc_avg_point(wall);
    
                // find the corner between the center and the target wall point
                let corner_to_wall = calc_corner_between_points2(center, wall_midpoint, true);
                let center_corridor_path = [center, corner_to_wall, wall_midpoint];
                
                all_corridor_paths.push(center_corridor_path);
                center_lines.push(...lines_from_path(center_corridor_path, false));
                adjacent_info.path_to_wall = center_corridor_path;
            }
        }

        // make corridors from center point to non adjacent walls
        let non_connected_coords_list = get_non_connected_building_coords(building_id);
        let non_connected_path = [];

        for (let i = 0; i < non_connected_coords_list.length; i++) {
            let non_connected_grid_coords = non_connected_coords_list[i];

            let far_from_center = calc_point_translation(center, building_grid_coords, non_connected_grid_coords, grid.length * 2);
            let closest_wall_intersection = calc_closest_intersection_for_lines(building_mods.outline_grid_walls, [center, far_from_center], center);

            if (closest_wall_intersection !== null) {
                non_connected_path.push(center, closest_wall_intersection, center);
            }
        }
        all_corridor_paths.push(non_connected_path);

    }
    building_mods.corridor_center_lines = center_lines;

    // make corridor to every door
    for (let door_id in door_mods) {
        let door_mod = door_mods[door_id];
        let door_grid_coords = grid_coords_for_building_or_door(door_mod.data_ref);

        let closest_center_corridor_point = calc_closest_point_to_lines(center_lines, door_grid_coords);
        let path_to_center = door_grid_path_to_center(cell_info, door_id);
        // let path_to_center = [door_grid_coords, closest_center_corridor_point];

        door_mod.corridor_path = path_to_center;
        // let corner_to_center_line = calc_corner_between_points2(door_grid_coords, closest_center_corridor_point, true);
        // let path_to_center = [door_grid_coords, corner_to_center_line, closest_center_corridor_point];
        all_corridor_paths.push(path_to_center);
    }

    building_mods.corridor_all_grid_paths = all_corridor_paths;
}


// get the door grid path to center coordinate
function door_grid_path_to_center(cell_info, door_id, center_override=null) {

    // TODO: this does lots of repeated calculations if called multiple times in a row... fix it

    let building_mods = cell_info.building_mods;
    let door_mods = cell_info.building_mods.entrance_mods;
    let door_mod = door_mods[door_id];
    let door_grid_coords = grid_coords_for_building_or_door(door_mod.data_ref);

    let shape_grid_center = center_override;

    if (shape_grid_center === null) {

        // let estimated_building_grid_coords = estimate_building_grid_coords(door_grid_coords);
        // let estimated_building_id = grid_cell_id_for_coords(estimated_building_grid_coords);
    
        // // get the calculated center of the building shape
        // // let shape_grid_center = cell_info.building_mods.outline_grid_center;
        // shape_grid_center = cell_info.building_mods.connection_mods[estimated_building_id].center;

        let closest_center_corridor_point = calc_closest_point_to_lines(building_mods.corridor_center_lines, door_grid_coords);
        shape_grid_center = closest_center_corridor_point;
    }

    // if shape grid center is still null, something is wrong...
    if (shape_grid_center == null) {
        return [door_grid_coords];
    }

    // let offset_door_grid_coords = {...door_grid_coords};
    // let quadrant = calc_point_quadrant(offset_door_grid_coords, shape_grid_center);

    // let convex = Math.random() > 0.5;
    // let convex = true;
    // let cutout_weight = Math.random();
    // let use_cutout_corner = Math.random() > 0.65;

    // if (door_mod.orientation === "up") {
    //     offset_door_grid_coords.y += door_len_ratio;
        
    //     if (quadrant === "NW") {
    //         convex = false; // false is proper value to go straight to center line, but need to flip to prevent swasticas
    //         // convex = true;
    //         // use_cutout_corner = true;
    //     } else if (quadrant === "NE") {
    //         convex = true;
    //     } 
    //     // TODO: these happen on concave shapes, need more work to figure out which...
    //     /*
    //     else if (quadrant === "SW") { // doesn't happen on squares
    //         convex = false;
    //     } else if (quadrant === "SE") { // doesn't happen on squares
    //         convex = false;
    //     }
    //     */

    // } else if (door_mod.orientation === "right") {
    //     offset_door_grid_coords.x -= door_len_ratio;

    //     if (quadrant === "SE") { 
    //         convex = true; // true is proper value to go straight to center line, but need to flip to prevent swasticas
    //         // convex = false;
    //         // use_cutout_corner = true;
    //     } else if (quadrant === "NE") {
    //         convex = false;
    //     } 
    //     /*
    //     else if (quadrant === "SW") { // doesn't happen on squares
    //         convex = false;
    //     } else if (quadrant === "NW") { // doesn't happen on squares
    //         convex = false;
    //     } 
    //     */

    // } else if (door_mod.orientation === "down") {
    //     offset_door_grid_coords.y -= door_len_ratio;

    //     if (quadrant === "SW") {
    //         convex = true;
    //     } else if (quadrant === "SE") { 
    //         convex = false; // false is proper value to go straight to center line, but need to flip to prevent swasticas
    //         // convex = true;
    //         // use_cutout_corner = true;
    //     } 
    //     /* 
    //     else if (quadrant === "NW") { // doesn't happen on squares
    //         convex = true;
    //     } else if (quadrant === "NE") { // doesn't happen on squares
    //         convex = false;
    //     }
    //     */

    // } else if (door_mod.orientation === "left") {
    //     offset_door_grid_coords.x += door_len_ratio;

    //     if (quadrant === "NW") {
    //         convex = true; // true is proper value to go straight to center line, but need to flip to prevent swasticas
    //         // convex = false;
    //         // use_cutout_corner = true;
    //     } else if (quadrant === "SW") {
    //         convex = false;
    //     } 
    //     /*
    //     else if (quadrant === "NE") { // doesn't happen on squares
    //         convex = false;
    //     } else if (quadrant === "SE") { // doesn't happen on squares
    //         convex = false;
    //     }
    //     */
    // } else {
    //     console.log("door does not have orientation...", cell_info, door_id);
    // }

    // let corner_path = null;

    // if (use_cutout_corner) {
    //     corner_path = calc_cutout_corner_between_points(offset_door_grid_coords, shape_grid_center, convex, 0.25, 0.75);
    // } else {
    //     let corner = calc_corner_between_points(offset_door_grid_coords, shape_grid_center, convex);
    //     corner_path = [corner];
    // }

    // return [door_grid_coords, offset_door_grid_coords, ...corner_path, shape_grid_center];

    // calculate grid points in all directions from center
    let center_grid_left   = calc_point_translation(shape_grid_center, {x:0, y:0}, {x:grid.length, y:0}, grid.length);
    let center_grid_right  = calc_point_translation(shape_grid_center, {x:0, y:0}, {x:-grid.length, y:0}, grid.length);
    let center_grid_up     = calc_point_translation(shape_grid_center, {x:0, y:0}, {x:0, y:grid.length}, grid.length);
    let center_grid_down   = calc_point_translation(shape_grid_center, {x:0, y:0}, {x:0, y:-grid.length}, grid.length);

    let center_line_end = null;

    // check quadrant of door and door orientation (quadrant names and checks are probably wrong since i'm not considering inverted y shenanigans)
    // top right quadrant
    if (door_grid_coords.x >= shape_grid_center.x && door_grid_coords.y >= shape_grid_center.y) {
        if (door_mod.wall_direction === "vertical") {
            center_line_end = center_grid_up;
        } else {
            center_line_end = center_grid_left;
        }
    
    // bottom right quadrant
    } else if (door_grid_coords.x >= shape_grid_center.x && door_grid_coords.y <= shape_grid_center.y) {
        if (door_mod.wall_direction === "vertical") {
            center_line_end = center_grid_down;
        } else {
            center_line_end = center_grid_left;
        }

    // top left quadrant
    } else if (door_grid_coords.x <= shape_grid_center.x && door_grid_coords.y >= shape_grid_center.y) {
        if (door_mod.wall_direction === "vertical") {
            center_line_end = center_grid_up;
        } else {
            center_line_end = center_grid_right;
        }

    // bottom left quadrant
    } else if (door_grid_coords.x <= shape_grid_center.x && door_grid_coords.y <= shape_grid_center.y) {
        if (door_mod.wall_direction === "vertical") {
            center_line_end = center_grid_down;
        } else {
            center_line_end = center_grid_right;
        }
    }

    // calculate closest point to the determined center line
    let closest_point = calc_closest_point(shape_grid_center, center_line_end, door_grid_coords);

    // return the list of points representing the path to the center of the building
    return [door_grid_coords, closest_point, shape_grid_center];
}


// get the path that connects the center points of two doors
function connect_door_grid_center_path(cell_info, door_id1, door_id2) {

    // get cell info
    let building_mods = cell_info.building_mods;
    let connection_mods = building_mods.connection_mods;
    let door_mods = building_mods.entrance_mods;
    
    // get info for each door to connect to
    let door_mod1 = door_mods[door_id1];
    let door_mod2 = door_mods[door_id2];

    let door1_grid_coords = grid_coords_for_building_or_door(door_mod1.data_ref);
    let door2_grid_coords = grid_coords_for_building_or_door(door_mod2.data_ref);

    let building1_grid_coords = estimate_building_grid_coords(door1_grid_coords);
    let building2_grid_coords = estimate_building_grid_coords(door2_grid_coords);

    let building1_id = grid_cell_id_for_coords(building1_grid_coords);
    let building2_id = grid_cell_id_for_coords(building2_grid_coords);

    // get the list of connected building ids as ints
    let connected_building_ids = Object.keys(building_mods.connection_mods).map(id => Number(id));

    // helper recursive function in order to find the path between connected buildings
    function find_building_path(remaining_ids, path, cur_id, end_id) {
        // console.log("find_building_path: ", remaining_ids, path, cur_id, end_id);

        // base case, the current line and end line are equal
        if (cur_id === end_id) {
            // console.log("base case! cur line is end line");
            return path;
        }

        let cur_adjacent_cells_info = building_mods.connection_mods[cur_id].adjacent_cells;

        // iterate over every remaining line
        for (let i = 0; i < remaining_ids.length; i++) {
            let next_id = remaining_ids[i];

            // check if the next line connects with the current line
            if (!(next_id in cur_adjacent_cells_info)) {
                continue;
            }

            // add the next line onto the path
            path.push(next_id);

            // TODO: probably a better way to do this than making a new array every time...
            let new_remaining = [...remaining_ids];
            new_remaining.splice(i, 1);

            // perform the recursion
            let res = find_building_path(new_remaining, path, next_id, end_id);

            if (res !== null) {
                return res;
            }

            // path not found, remove the previously added line from the path
            path.pop();
        }

        // could not find a path
        // console.log("backtrack case, could not find a path");
        return null;
    }

    // remove the start building from the search list
    connected_building_ids.splice(connected_building_ids.indexOf(building1_id), 1);

    // find the connected path through the buildings
    let connected_building_ids_path = find_building_path(connected_building_ids, [building1_id], building1_id, building2_id);

    // store the constructed the center path from the building path
    let connected_centers_path = [];

    let best_adjacency_id1 = null;
    let best_adjacency_point1 = null;
    let best_adjacency_dist = Number.MAX_SAFE_INTEGER;

    // find the closest point from the door1 to the building center lines
    for (let adjacent_building_id in connection_mods[building1_id].adjacent_cells) {

        let center_lines = lines_from_path(connection_mods[building1_id].adjacent_cells[adjacent_building_id].path_to_wall);

        let closest_point = calc_closest_point_to_lines(center_lines, door1_grid_coords);
        let dist = calc_dist(closest_point, door1_grid_coords);

        if (dist < best_adjacency_dist) {
            best_adjacency_dist = dist;
            best_adjacency_id1 = adjacent_building_id;
            best_adjacency_point1 = closest_point;
        }
    }

    let best_adjacency_id2 = null;
    let best_adjacency_point2 = null;
    best_adjacency_dist = Number.MAX_SAFE_INTEGER;

    // find the closest point from the door2 to the building center lines
    for (let adjacent_building_id in connection_mods[building2_id].adjacent_cells) {

        let center_lines = lines_from_path(connection_mods[building2_id].adjacent_cells[adjacent_building_id].path_to_wall);

        let closest_point = calc_closest_point_to_lines(center_lines, door2_grid_coords);
        let dist = calc_dist(closest_point, door2_grid_coords);

        if (dist < best_adjacency_dist) {
            best_adjacency_dist = dist;
            best_adjacency_id2 = adjacent_building_id;
            best_adjacency_point2 = closest_point;
        }
    }

    let center_path1 = connection_mods[building1_id].adjacent_cells[best_adjacency_id1].path_to_wall;
    let center_path2 = connection_mods[building2_id].adjacent_cells[best_adjacency_id2].path_to_wall;

    // there is only one connected building in the path
    if (connected_building_ids_path.length === 1) {

        let vert_or_horz = calc_line_orthogonal_direction(best_adjacency_point1, best_adjacency_point2);

        if (best_adjacency_id1 === best_adjacency_id2 && vert_or_horz !== null) {
            connected_centers_path = [best_adjacency_point1, best_adjacency_point2];
        } else {
            let cutoff_path1 = calc_path_cutoff_at_point(center_path1, best_adjacency_point1).toReversed();
            let cutoff_path2 = calc_path_cutoff_at_point(center_path2, best_adjacency_point2);
            connected_centers_path = [...cutoff_path1, ...cutoff_path2];
        }

    // there are at least two connected buildings in the path
    } else {

        // construct the main connecting path between centers
        for (let i = 0; i < connected_building_ids_path.length - 1; i++) {

            let cur_id = connected_building_ids_path[i];
            let next_id = connected_building_ids_path[i + 1];
    
            // add the path from the current building center to the next adjacent cell wall
            connected_centers_path.push(...connection_mods[cur_id].adjacent_cells[next_id].path_to_wall);
    
            // add the path from the next building center to the current cell wall
            connected_centers_path.push(...connection_mods[next_id].adjacent_cells[cur_id].path_to_wall.toReversed());
        }

        // if connected to the start adjacency path of the first building, remove it and replace with cutoff path
        if (best_adjacency_id1 == connected_building_ids_path[1]) {
            let cutoff_path = calc_path_cutoff_at_point(center_path1.toReversed(), best_adjacency_point1).toReversed();
            connected_centers_path.splice(0, 3, ...cutoff_path);

        // otherwise, need to add a new path part for actual connection
        } else {
            let cutoff_path = calc_path_cutoff_at_point(center_path1, best_adjacency_point1).toReversed();
            connected_centers_path.splice(0, 0, ...cutoff_path);
        }

        console.log(connected_centers_path);
        
        // if connected to the end adjacency path of the last building, remove it and replace with cutoff path
        if (best_adjacency_id2 == connected_building_ids_path[connected_building_ids_path.length-2]) {
            let cutoff_path = calc_path_cutoff_at_point(center_path2.toReversed(), best_adjacency_point2);
            connected_centers_path.splice(connected_centers_path.length-3, 3, ...cutoff_path);

        // otherwise, need to add a new path part for actual connection
        } else {
            let cutoff_path = calc_path_cutoff_at_point(center_path2, best_adjacency_point2);
            connected_centers_path.push(...cutoff_path);
        }
    }

    return simplify_path(connected_centers_path, false);
}

// get the path that connects the center points of two doors
function connect_building_cell_walls_grid_path(building1_id, wall_direction1, building2_id, wall_direction2, target_end_coords, path_grid_offset) {

    // console.log("connect building cell wells building1_id:", building1_id, wall_direction1, "building2_id: ", building2_id, wall_direction2);

    // construct a wall usability grid for each grid cell
    let usable_grid_walls = [];
    
    // iterate over every grid cell
    for (let y = 0; y < grid.length; y++) {
        let row = [];
        for (let x = 0; x < grid.length; x++) {

            let grid_coords = {x:x, y:y};
            let building_id = grid_coords_to_building_id(grid_coords);

            let cell_usability = {
                id: building_id,
                up: true,
                down: true,
                right: true,
                left: true, 
            };

            // check all directions from the current cell
            for (let d = 0; d < ordered_directions.length; d++) {
                let direction = ordered_directions[d];
                let adjacent_coords = calc_adjacent_grid_coord(grid_coords, direction);
                
                // don't check adjaceny if out of bounds
                if (adjacent_coords.x < 0 || adjacent_coords.x >= grid.length || adjacent_coords.y < 0 || adjacent_coords.y >= grid.length) {
                    continue;
                }

                // check if the adjacent builing in the given direction is connected
                let adjacent_id = grid_coords_to_building_id(adjacent_coords);
                if (check_building_connected_adjacency(building_id, adjacent_id)) {
                    cell_usability[direction] = false;
                }
            }
      
            row.push(cell_usability);
        }

        usable_grid_walls.push(row);
    }

    // helper method to get the usable neighbors of a given building wall
    function get_usable_neighbors(entry) {

        let neighbors = [];
        let coords = grid_coords_for_building_id(entry.cell_id);
        let cur_usability = usable_grid_walls[coords.y][coords.x];
        let wall_dir = entry.wall_dir;

        if (wall_dir === "left" || wall_dir === "right") {

            // check if matching wall direction in up cell is usable
            if (coords.y - 1 >= 0) {
                let adj_up_usability = usable_grid_walls[coords.y - 1][coords.x];
                if (adj_up_usability[wall_dir]) {
                    neighbors.push({cell_id: adj_up_usability.id, wall_dir: wall_dir});
                }
            }

            // check if matching wall direction in down cell is usable
            if (coords.y + 1 < usable_grid_walls.length) {
                let adj_down_usability = usable_grid_walls[coords.y + 1][coords.x];
                if (adj_down_usability[wall_dir]) {
                    neighbors.push({cell_id: adj_down_usability.id, wall_dir: wall_dir});
                }
            }

            // check if cell adjacent to wall_dir has usable up / down walls
            let left_right_offset = wall_dir === "left" ? -1 : 1;
            if (coords.x + left_right_offset >= 0 && coords.x + left_right_offset < usable_grid_walls.length) {
                let adj_left_right_usability = usable_grid_walls[coords.y][coords.x + left_right_offset];
                if (adj_left_right_usability.up) {
                    neighbors.push({cell_id: adj_left_right_usability.id, wall_dir: "up"});
                }
                if (adj_left_right_usability.down) {
                    neighbors.push({cell_id: adj_left_right_usability.id, wall_dir: "down"});
                }
            }

            // check if current cell's up / down walls are usable
            if (cur_usability.up) {
                neighbors.push({cell_id: cur_usability.id, wall_dir: "up"});
            }
            if (cur_usability.down) {
                neighbors.push({cell_id: cur_usability.id, wall_dir: "down"});
            }

        } else if (wall_dir === "up" || wall_dir === "down") {

            // check if matching wall direction in left cell is usable
            if (coords.x - 1 >= 0) {
                let adj_left_usability = usable_grid_walls[coords.y][coords.x - 1];
                if (adj_left_usability[wall_dir]) {
                    neighbors.push({cell_id: adj_left_usability.id, wall_dir: wall_dir});
                }
            }

            // check if matching wall direction in right cell is usable
            if (coords.x + 1 < usable_grid_walls.length) {
                let adj_right_usability = usable_grid_walls[coords.y][coords.x + 1];
                if (adj_right_usability[wall_dir]) {
                    neighbors.push({cell_id: adj_right_usability.id, wall_dir: wall_dir});
                }
            }

            // check if cell adjacent to wall_dir has usable left / right walls
            let up_down_offset = wall_dir === "up" ? -1 : 1;
            if (coords.y + up_down_offset >= 0 && coords.y + up_down_offset < usable_grid_walls.length) {
                let adj_up_down_usability = usable_grid_walls[coords.y + up_down_offset][coords.x];
                if (adj_up_down_usability.left) {
                    neighbors.push({cell_id: adj_up_down_usability.id, wall_dir: "left"});
                }
                if (adj_up_down_usability.right) {
                    neighbors.push({cell_id: adj_up_down_usability.id, wall_dir: "right"});
                }
            }

            // check if current cell's up / down walls are usable
            if (cur_usability.left) {
                neighbors.push({cell_id: cur_usability.id, wall_dir: "left"});
            }
            if (cur_usability.right) {
                neighbors.push({cell_id: cur_usability.id, wall_dir: "right"});
            }
        }

        // find paired wall in adjacent cells for each found neighbor
        let neighbor_pairs = [];
        
        for (let i = 0; i < neighbors.length; i++) {

            let neighbor = neighbors[i];
            let opposite_dir = get_opposite_direction(neighbor.wall_dir);

            let cell_coords = grid_coords_for_building_id(neighbor.cell_id);
            let adj_coords = calc_adjacent_grid_coord(cell_coords, neighbor.wall_dir);

            // found neighbors are guaranteed to have a matching adjacent wall unless out of bounds
            if (adj_coords.x < 0 || adj_coords.x >= grid.length || adj_coords.y < 0 || adj_coords.y >= grid.length) {
                continue;
            }

            let adj_id = grid_coords_to_building_id(adj_coords);
            neighbor_pairs.push({cell_id: adj_id, wall_dir: opposite_dir});
        };

        return neighbors.concat(neighbor_pairs);
    }

    // get the grid coords of a given wall based on the cell coords and direction
    function get_wall_grid_coords(wall) {
        let wall_cell_coords = grid_coords_for_building_id(wall.cell_id);

        if (wall.wall_dir === "left") {
            wall_cell_coords.y += 0.5;
        } else if (wall.wall_dir === "right") {
            wall_cell_coords.y += 0.5;
            wall_cell_coords.x += 1;
        } else if (wall.wall_dir === "up") {
            wall_cell_coords.x += 0.5;
        } else if (wall.wall_dir === "down") {
            wall_cell_coords.y += 1;
            wall_cell_coords.x += 0.5;
        }

        return wall_cell_coords;
    }

    // helper function to convert the wall to a grid coords line in the proper order
    function wall_to_grid_line(wall) {
        let cell_coords = grid_coords_for_building_id(wall.cell_id);
        let cell_corners = [
            {x:cell_coords.x-0.5+path_grid_offset, y:cell_coords.y-0.5+path_grid_offset}, 
            {x:cell_coords.x+0.5-path_grid_offset, y:cell_coords.y-0.5+path_grid_offset}, 
            {x:cell_coords.x+0.5-path_grid_offset, y:cell_coords.y+0.5-path_grid_offset},
            {x:cell_coords.x-0.5+path_grid_offset, y:cell_coords.y+0.5-path_grid_offset}
        ];
        let dir_index = ordered_directions.indexOf(wall.wall_dir);
        return [cell_corners[dir_index], cell_corners[(dir_index + 1) % 4]];
    }

    // initialize start and end walls for path finding
    let start = {cell_id: building1_id, wall_dir: wall_direction1};
    let start_str = JSON.stringify(start);
    let end = {cell_id: building2_id, wall_dir: wall_direction2};
    let end_str = JSON.stringify(end);

    // intialize priority queue for dijkastra
    let pqueue = new TinyQueue([{item: start, priority: 0}], function (a, b) {
        return a.priority - b.priority;
    });
    let came_from = new Map();
    came_from.set(start_str, null);

    // perform dijkastra search on the usable walls
    while (pqueue.length > 0) {
        let cur_entry = pqueue.pop();
        let cur = cur_entry.item;
        let cur_str = JSON.stringify(cur);

        if (cur_str === end_str) {
            break;
        }

        let cur_neighbors = get_usable_neighbors(cur);

        for (let i = 0; i < cur_neighbors.length; i++) {
            let next = cur_neighbors[i];
            let next_str = JSON.stringify(next);

            if (came_from.has(next_str)) {
                continue;
            }

            let next_wall_line = wall_to_grid_line(next);

            priority = Math.min(calc_manhattan_dist(next_wall_line[0], target_end_coords), calc_manhattan_dist(next_wall_line[1], target_end_coords));

            pqueue.push({item:next, priority: priority});
            came_from.set(next_str, cur_str);
        }
    }

    // reconstruct the path
    let cur_str = end_str;

    // TODO: this prevents the error from occuring, but paths still go through the building
    // need to choose and replace start and end point when they themselves are unreachable
    // check if the end goal could not be reached
    // if (came_from.get(cur_str) == null) {

    //     // try to find neighbor of end that was reached
    //     let end_neigbors = get_usable_neighbors(end);
    //     console.log("end neighbors: ", end_neigbors);

    //     for (let i = 0; i < end_neigbors.length; i++) {
    //         let neighbor = end_neigbors[i];
    //         let neighbor_str = JSON.stringify(neighbor);

    //         if (came_from.get(neighbor_str) != null) {
    //             cur_str = neighbor_str;
    //             break;
    //         }
    //     }

    //     console.log(usable_grid_walls);
    //     console.log("selected neighbor: ", cur_str);
    // }

    let wall_path = [];

    while (cur_str !== start_str) {

        let cur = null;
        try {
            cur = JSON.parse(cur_str);
        } catch(e) {
            console.log(e);
            console.log("cur str:", cur_str);
            console.log("came_from: ", came_from);
            console.log("wall_path: ", wall_path);
        }
        
        if (cur === null) {
            break;
        }

        // cur.priority = calc_wall_heuristic(cur, end);
        wall_path.push(cur);
        cur_str = came_from.get(cur_str);
    }
    wall_path.push(start);
    wall_path.reverse();

    // convert wall path to grid lines
    let wall_grid_lines = [];

    // iterate over sequential pairs of walls to create grid lines
    for (let i = 0; i < wall_path.length - 1; i++) {

        let wall1 = wall_path[i];
        let wall2 = wall_path[i+1];

        let wall1_grid_line = wall_to_grid_line(wall1);
        let wall2_grid_line = wall_to_grid_line(wall2);

        // sort the current grid line so that it lines up properly with the next grid wall
        wall1_grid_line.sort((a, b) => {
            let a_closest = Math.min(calc_dist(a, wall2_grid_line[0]), calc_dist(a, wall2_grid_line[1]));
            let b_closest = Math.min(calc_dist(b, wall2_grid_line[0]), calc_dist(b, wall2_grid_line[1]));

            return b_closest - a_closest;
        });

        wall_grid_lines.push(wall1_grid_line);
    }

    // add the final wall (sorting to end point)
    let final_wall_grid_line = wall_to_grid_line(wall_path[wall_path.length-1]);
    let penult_wall_grid_line = wall_grid_lines[wall_grid_lines.length-1];
    final_wall_grid_line.sort((a, b) => {
        return calc_dist(a, penult_wall_grid_line[1]) - calc_dist(b, penult_wall_grid_line[1]);
    });
    wall_grid_lines.push(final_wall_grid_line);

    // finally construct a path of points for each wall
    let grid_path = [];

    // iterate over sequential pairs of grid lines to add them and a corner between them to a final path
    for (let i = 0; i < wall_grid_lines.length - 1; i++) {
        let wall1_grid_line = wall_grid_lines[i];
        let wall2_grid_line = wall_grid_lines[i + 1];

        let corner = calc_corner_between_points(wall1_grid_line[1], wall2_grid_line[0]);

        grid_path.push(...wall1_grid_line, corner);
    }
    grid_path.push(...final_wall_grid_line);

    return grid_path;
}


// get the door grid path to center coordinate
function door_grid_path_to_border(cell_info, door_id, outline_offset, door_offset) {

    let door_mods = cell_info.building_mods.entrance_mods;
    let door_mod = door_mods[door_id];
    
    let door_grid_coords = grid_coords_for_building_or_door(door_mod.data_ref);
    // let building_grid_coords = grid_coords_for_building_or_door(cell_info.building_data);
    let building_grid_coords = estimate_building_grid_coords(door_grid_coords);
    let building_id = grid_coords_to_building_id(building_grid_coords);

    // offset door grid coords
    if (door_mod.wall_direction === "vertical") {
        door_grid_coords.y += door_offset;
    } else {
        door_grid_coords.x += door_offset;
    }

    // adjusted to be door coordinates
    let building_grid_corners = [
        {x:building_grid_coords.x-0.5, y:building_grid_coords.y-0.5}, 
        {x:building_grid_coords.x+0.5, y:building_grid_coords.y-0.5}, 
        {x:building_grid_coords.x+0.5, y:building_grid_coords.y+0.5},
        {x:building_grid_coords.x-0.5, y:building_grid_coords.y+0.5}
    ];

    let best_point = null;
    // console.log("orientation: ", door_mod.orientation);

    if (door_mod.orientation === "up") {
        let building_top_line = [building_grid_corners[0], building_grid_corners[1]];
        best_point = calc_closest_point(building_top_line[0], building_top_line[1], door_grid_coords);
    } else if (door_mod.orientation === "down") {
        let building_bottom_line = [building_grid_corners[2], building_grid_corners[3]];
        best_point = calc_closest_point(building_bottom_line[0], building_bottom_line[1], door_grid_coords);
    } else if (door_mod.orientation === "left") {
        let building_left_line = [building_grid_corners[3], building_grid_corners[0]];
        best_point = calc_closest_point(building_left_line[0], building_left_line[1], door_grid_coords);
    } else if (door_mod.orientation === "right") {
        let building_right_line = [building_grid_corners[1], building_grid_corners[2]];
        best_point = calc_closest_point(building_right_line[0], building_right_line[1], door_grid_coords);
    }

    // offset the best point
    best_point = calc_line_extend_point(door_grid_coords, best_point, -1 * outline_offset);

    return {
        path: [door_grid_coords, best_point],
        wall_dir: door_mod.orientation
    }
}


// find the path from an endpoint to cell border
function endpoint_grid_path_to_border(building_grid_coords, door_grid_coords, outline_offset, door_offset, target_door_grid_coords=null) {

    // adjusted to be door coordinates
    let building_grid_corners = [
        {x:building_grid_coords.x-0.5, y:building_grid_coords.y-0.5}, 
        {x:building_grid_coords.x+0.5, y:building_grid_coords.y-0.5}, 
        {x:building_grid_coords.x+0.5, y:building_grid_coords.y+0.5},
        {x:building_grid_coords.x-0.5, y:building_grid_coords.y+0.5}
    ];

    // calculate walls from the corners
    let walls = [];
    for (let i = 0; i < building_grid_corners.length; i++) {
        let corner1 = building_grid_corners[i];
        let corner2 = building_grid_corners[(i + 1) % building_grid_corners.length];

        walls.push([corner1, corner2]);
    }

    let best_wall = null;

    // target door provided, find the wall that intersects with the line between endpoint and target door
    if (target_door_grid_coords !== null) {
               
        let target_line = [door_grid_coords, target_door_grid_coords];
        let potential_best_wall = null;

        // iterate over every wall
        for (let i = 0; i < walls.length; i++) {

            let wall = walls[i];
            let intersection = calc_lines_intersection(wall, target_line);

            if (intersection !== null) {
                let closest_point = calc_closest_point(wall[0], wall[1], door_grid_coords);
                let dist = calc_dist(closest_point, door_grid_coords);
    
                potential_best_wall = {
                    point: closest_point,
                    dist: dist,
                    wall_dir: ordered_directions[i],
                    wall: wall
                };

                break;
            }
        }

        if (potential_best_wall !== null) {
            // check if potential best wall intersects building
            let cell_info = grid_object_at_coords(building_grid_coords);
            let potential_path = [door_grid_coords, potential_best_wall.point];
            let building_intersection = check_line_intersects_building(cell_info, potential_path);

            // no intersection found
            if (building_intersection === null) {
                best_wall = potential_best_wall;
            }
        }
    } 

    // best wall has not been found by previous attempts, just select the closest
    if (best_wall === null) {

        // get dist and point for each wall
        let wall_dist_points = walls.map(function (wall, index) {
            let closest_point = calc_closest_point(wall[0], wall[1], door_grid_coords);
            let dist = calc_dist(closest_point, door_grid_coords);

            return {
                point: closest_point,
                dist: dist,
                wall_dir: ordered_directions[index],
                wall: wall
            };
        });

        // sort the walls based on closest point
        wall_dist_points.sort((a, b) => a.dist - b.dist);
        best_wall = wall_dist_points[0];
    }

    // offset the starting point and wall point
    let best_point = best_wall.point;
    
    if (best_wall.wall_dir === "left") {
        best_point.x += outline_offset;
    } else if (best_wall.wall_dir === "up") {
        best_point.y += outline_offset;
    } else if (best_wall.wall_dir === "right") {
        best_point.x -= outline_offset;
    } else if (best_wall.wall_dir === "down") {
        best_point.y -= outline_offset;
    }
    
    // let best_point = calc_line_extend_point(door_grid_coords, best_wall.point, -1 * outline_offset);
    best_point = calc_point_translation(best_point, best_wall.wall[0], best_wall.wall[1], door_offset)
    let offset_door_grid_coords = calc_point_translation(door_grid_coords, best_wall.wall[0], best_wall.wall[1], door_offset);

    return {
        path: [offset_door_grid_coords, best_point],
        wall_dir: best_wall.wall_dir
    };
}


// gets the location status of a given endpoint
function get_endpoint_location_status(endpoint_door_grid_coords) {

    let endpoint_building_grid_coords = estimate_building_grid_coords(endpoint_door_grid_coords);

    // endpoint is out of grid bounds, status 0
    if (endpoint_building_grid_coords.x < 0 || endpoint_building_grid_coords.x >= grid.length 
        || endpoint_building_grid_coords.y < 0 || endpoint_building_grid_coords.y >= grid.length) {
        
        return 0;
    }

    // check if end point is inside or outside the building of the cell
    let cell_info = grid_object_at_coords(endpoint_building_grid_coords);
    let walls = cell_info.building_mods.outline_grid_walls;

    let far_point = {x:-grid.length, y:-grid.length};
    let from_far_line = [far_point, endpoint_door_grid_coords];
    let num_intersections = 0;

    walls.forEach(function (wall) {
        let intersection_point = calc_lines_intersection(from_far_line, wall);

        if (intersection_point !== null) {
            num_intersections += 1;
        }
    });

    let is_outside = num_intersections % 2 === 0;

    // endpoint inside grid, outside building, status 1
    if (is_outside) {
        return 1
    }

    // endpoint inside grid, inside building, status 2
    return 2;
}


// find orientation of doors
function find_all_doors_orientations(cell_info) {

    // iterate over every door and find it's orientation
    for (let door_id in cell_info.building_mods.entrance_mods) {
        find_door_orientation(cell_info, door_id);
    }
}


// calculate and set the orientation of a given door
function find_door_orientation(cell_info, door_id, door_grid_coords_override=null, wall_direction_override=null) {

    let door_mods = cell_info.building_mods.entrance_mods;
    let door_mod = door_mods[door_id];
    let door_grid_coords = door_grid_coords_override !== null ? door_grid_coords_override : grid_coords_for_building_or_door(door_mod.data_ref);

    let building_grid_coords = estimate_building_grid_coords(door_grid_coords);
    let building_id = grid_coords_to_building_id(building_grid_coords);

    let direction = wall_direction_override !== null ? wall_direction_override : door_mod.wall_direction;
    
    let orientation = null;
    let walls = cell_info.building_mods.outline_grid_walls;
    
    // TODO: i tried to increase the precision and reduce the number of edge cases by adding more far lines then averaging them, however that just made it worse ...
    let far_door_grid_coords_list = [
        {x: door_grid_coords.x - grid.length * 2, y: door_grid_coords.y  - grid.length * 2},
    ];

    let offset_door_grid_coords = null;

    // door is vertical
    if (direction === "vertical") {

        // guess offset is point inside building
        offset_door_grid_coords = {
            x: door_grid_coords.x+door_len_ratio/4, // offset is arbitrary, assuming it is small enough where it won't pass through other side of skinny building,
            y: door_grid_coords.y
        };

    // door is horizontal
    } else {

        // guess offset is point inside building
        offset_door_grid_coords = {
            x: door_grid_coords.x, 
            y: door_grid_coords.y+door_len_ratio/4 // offset is arbitrary, assuming it is small enough where it won't pass through other side of skinny building,
        };
    }

    // create lines from the far point to the offset door coords
    let from_far_lines = far_door_grid_coords_list.map(far_door_grid_coords => [far_door_grid_coords, offset_door_grid_coords]);
    let num_intersections = 0;

    // calculate the number of intersections of line to right/left borders with each wall
    walls.forEach(function (wall) {

        for (let i = 0; i < from_far_lines.length; i++) {

            let from_far_line = from_far_lines[i];
            let intersection_point = calc_lines_intersection(from_far_line, wall);

            if (intersection_point !== null) {
                num_intersections += 1;
            }
        }
    });

    // get the average number of intersections based on the number of far lines used
    let avg_num_intersections = Math.round(num_intersections / from_far_lines.length);

    // determine door direction by checking if offset guess was correct
    if (direction === "vertical") {
        if (avg_num_intersections % 2 === 0) {
            orientation = "right";
        } else {
            orientation = "left";
        }
    } else {
        if (avg_num_intersections % 2 === 0) {
            orientation = "down";
        } else {
            orientation = "up";
        }
    }

    if (door_id !== null) {
        // set the orientation of the door
        door_mod.orientation = orientation;
    }
}


// get a list of non-connected building ids for a given building id
function get_non_connected_building_coords(building_id) {

    let building_grid_coords = grid_coords_for_building_id(building_id);
    let cell_info = grid_object_at_coords(building_grid_coords);

    if (cell_info.building_data === null) {
        return [];
    }

    let left_coords   = {x:building_grid_coords.x-1, y:building_grid_coords.y};
    let right_coords  = {x:building_grid_coords.x+1, y:building_grid_coords.y};
    let up_coords     = {x:building_grid_coords.x, y:building_grid_coords.y-1};
    let down_coords   = {x:building_grid_coords.x, y:building_grid_coords.y+1};

    let non_connected_coords = [left_coords, right_coords, up_coords, down_coords];

    return non_connected_coords.filter((coords) => {
        let id = grid_coords_to_building_id(coords);
        return !(id in cell_info.building_mods.connection_mods[building_id].adjacent_cells);
    });
}


// check if a given line intersects a given building
function check_line_intersects_building(cell_info, line) {

    let intersection = null;

    // check if there is a building at the given building data
    if (cell_info !== null && cell_info.building_data !== null) {

        let outline_walls = cell_info.building_mods.outline_grid_walls;

        // iterate over every wall in the building
        for (let i = 0; i < outline_walls.length; i++) {
            let wall = outline_walls[i];
            intersection = calc_lines_intersection(wall, line);

            if (intersection !== null) {
                break
            }
        }
    }
    
    return intersection;
}


// get the closest grid coords for out of bounds grid coords
function closest_cell_coords_for_out_of_bounds(building_grid_coords) {
    // check if building grid coords is out of bounds and adjust to closest cell in grid
    if (building_grid_coords.x < 0 || building_grid_coords.x >= grid.length || building_grid_coords.y < 0 || building_grid_coords.y >= grid.length) {

        // NW corner
        if (building_grid_coords.x <= 0 && building_grid_coords.y <= 0) {
            building_grid_coords = {
                x: 0, 
                y: 0
            };
        // NE corner
        } else if (building_grid_coords.x >= grid.length && building_grid_coords.y <= 0) {
            building_grid_coords = {
                x: grid.length-1, 
                y: 0
            };
        // SE corner
        } else if (building_grid_coords.x >= grid.length && building_grid_coords.y >= grid.length) {
            building_grid_coords = {
                x: grid.length-1, 
                y: grid.length-1
            };
        // SW corner
        } else if (building_grid_coords.x <= 0 && building_grid_coords.y >= grid.length) {
            building_grid_coords = {
                x: 0, 
                y: grid.length-1
            };
        // up wall
        } else if (building_grid_coords.x >= 0 && building_grid_coords.x <= grid.length && building_grid_coords.y <= 0) {
            building_grid_coords = {
                x: building_grid_coords.x, 
                y: 0
            };
        // right wall
        } else if (building_grid_coords.y >= 0 && building_grid_coords.y <= grid.length && building_grid_coords.x >= grid.length) {
            building_grid_coords = {
                x: grid.length-1, 
                y: building_grid_coords.y
            };
        // down wall
        } else if (building_grid_coords.x >= 0 && building_grid_coords.x <= grid.length && building_grid_coords.y >= grid.length) {
            building_grid_coords = {
                x: building_grid_coords.x, 
                y: grid.length-1
            };
        // left wall
        } else if (building_grid_coords.y >= 0 && building_grid_coords.y <= grid.length && building_grid_coords.x <= 0) {
            building_grid_coords = {
                x: 0, 
                y: building_grid_coords.y
            };
        } 
    }

    return building_grid_coords;
}