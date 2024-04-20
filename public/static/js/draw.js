

/* -------------------------------------------------------------------------- */
/*                               canvas drawing                               */
/* -------------------------------------------------------------------------- */


/* --------------------------- drawing dimensions --------------------------- */


// calculate cell dimensions for the main stage and editor stage based on a given config 
function calculate_main_draw_dims(grid_len) {

    // get number of spaces between grid cells
    let num_spaces = grid_len - 1;

    let no_spacing_main_width = main_stage.width() / grid_len;
    let cell_spacing = cell_spacing_ratio * no_spacing_main_width;

    // calculate the dimensions of each building cell including spacing
    let main_cell_width = (main_stage.width() - num_spaces * cell_spacing) / grid_len;

    main_cell_dims = {
        size: main_cell_width,
        spacing: cell_spacing,
        stroke: main_cell_width * building_stroke_size_ratio
    };

    main_door_dims = {
        size: main_cell_dims.size * door_len_ratio,
        stroke:  main_cell_width * door_stroke_size_ratio
    };
}


// calculate building editor cell and door dims based on a given building
function calculate_editor_draw_dims(cell_info) {
    
    if (cell_info === null || cell_info.building_data === null) {
        return;
    }

    let building_bounding_grid_rect = cell_info.building_mods.normalized_bounding_rect;
    
    let bounds_width = calc_dist(building_bounding_grid_rect[0], building_bounding_grid_rect[1]);
    let bounds_height = calc_dist(building_bounding_grid_rect[1], building_bounding_grid_rect[2]);

    let editor_width = editor_stage.width();
    
    let editor_inset = editor_width * editor_inset_ratio;
    let editor_inset_size = editor_width - 2 * editor_inset;
    
    // let bounds_scale = Math.min(editor_inset_size / bounds_width, editor_inset_size / bounds_height) / editor_stage.scaleX();
    let bounds_scale = 1 / Math.max(bounds_width, bounds_height) * editor_inset_size;
    let door_size = door_len_ratio * bounds_scale;

    editor_cell_dims = {
        size: editor_inset_size,
        spacing: 0,
        stroke: bounds_scale * building_stroke_size_ratio
    };

    editor_door_dims = {
        size: door_size,
        stroke: bounds_scale * door_stroke_size_ratio
    };
}


// get the cell dimensions object for either the main stage or the editor stage
function get_cell_dims(for_main_stage) {
    return for_main_stage ? main_cell_dims : editor_cell_dims;
}


// get the door dimensions object for either the main stage or the editor stage
function get_door_dims(for_main_stage) {
    return for_main_stage ? main_door_dims : editor_door_dims;
}


// get door dimensions based on orientation
function get_directional_door_dims(cell_info, door_id, for_main_stage) {

    let door_dims = get_door_dims(for_main_stage);
    let building_grid_coords = grid_coords_for_building_or_door(cell_info.building_data);
    let door_mod = cell_info.building_mods.entrance_mods[door_id];
    
    // get door x and y coordinates (convert 1-indexed to 0-indexed)
    let door_grid_coords = grid_coords_for_building_or_door(door_mod.data_ref);

    // convert grid coordinates to stage coordinates
    let door_stage_coords = door_grid_coords_to_stage_coords(door_grid_coords, building_grid_coords, for_main_stage);

    let door_width = 0;
    let door_height = 0;
    let door_x = 0; 
    let door_y = 0;

    if (for_main_stage) {

        // set door dimensions based on orientation
        if (door_mod.orientation === "left") {
            door_width = door_dims.size / 2;
            door_height = door_dims.size;
            door_x = door_stage_coords.x;
            door_y = door_stage_coords.y - door_height/2;
        } else if (door_mod.orientation === "right") {
            door_width = door_dims.size / 2;
            door_height = door_dims.size;
            door_x = door_stage_coords.x - door_width;
            door_y = door_stage_coords.y - door_height/2;
        } else if (door_mod.orientation === "up") {
            door_width = door_dims.size;
            door_height = door_dims.size / 2;
            door_x = door_stage_coords.x - door_width/2;
            door_y = door_stage_coords.y;
        } else if (door_mod.orientation === "down") {
            door_width = door_dims.size;
            door_height = door_dims.size / 2;
            door_x = door_stage_coords.x - door_width/2;
            door_y = door_stage_coords.y - door_height;
        } else {
            console.log("no door orientation.. uh oh.. cell_info: ", cell_info, "door_id: ", door_id);
        }
    } else {
        door_width = door_dims.size;
        door_height = door_dims.size;
        door_x = door_stage_coords.x - door_width/2;
        door_y = door_stage_coords.y - door_height/2;
    }

    return {
        width: door_width,
        height: door_height,
        x: door_x,
        y: door_y
    };
}


// path type options to useable stage coordinates
function get_main_stage_path_dash(path_type) {

    let path_options = path_type_options[path_type];
    let door_dims = get_door_dims(true);
    let cell_dims = get_cell_dims(true);

    if (path_options.dash === null) {
        return null;
    }

    return path_options.dash.map((dash_part) => dash_part * cell_dims.size);
}


/* ----------------------------- color selection ---------------------------- */


// get the building color for the given cell
function get_building_color(cell_info) {

    if (building_con_colors_enabled) {
        let congestion_level = cell_info.building_data.congestion_type || cell_info.building_mods.con_level;
        let color = building_con_colors[congestion_level];

        if (color != null) {
            return color;
        }
    }
    
    // default to constant color if proper color not found
    return building_con_colors["constant"];
}


// get the corridor color for the given cell
function get_corridor_color(cell_info) {

    if (building_con_colors_enabled) {
        let congestion_level = cell_info.building_data.congestion_type || cell_info.building_mods.con_level;
        let color = corridor_con_colors[congestion_level];

        if (color != null) {
            return color;
        }
    }
    
    // default to constant color if proper color not found
    return corridor_con_colors["constant"];
}


/* ---------------------------- building drawing ---------------------------- */


// initialize and draw all elements for the main stage
function draw_main_stage() {

    // reset stage scale and position
    // main_stage.scale({x:1, y:1});
    // main_stage.position({x:0, y:0});

    // reset selections
    reset_cell_selections(auto_reset_path_endpoints_enabled, true);

    // clear the building editor
    reset_building_editor(true);

    // clear any previous layers
    main_stage.destroyChildren();

    // create the necessary layers to draw
    create_main_layers();

    // TODO: necessary every time main is drawn?
    // setup necessary callbacks
    // setup_main_stage_callbacks();

    // draw buildings 
    draw_buildings(building_layer);

    // draw roads display
    draw_roads(road_layer);

    // draw selection points
    draw_path_endpoint_selections(selection_layer);
}


// draw buildings on the main stage
function draw_buildings(parent) {
    
    // iterate over every grid cell
    for (let y = 0; y < grid.length; y++) {
        for (let x = 0; x < grid.length; x++) {

            let cell_info = grid[y][x];

            // do not draw empty cells
            if (cell_info.building_data === null) {
                continue;
            }

            let building_grid_coords = grid_coords_for_building_or_door(cell_info.building_data);
            
            // do not redraw connected buildings
            if (y != building_grid_coords.y || x != building_grid_coords.x) {
                continue;
            }

            // draw the building
            draw_building(cell_info, parent, true) 
        }
    }
}


// redraw the selected building on the main stage and the editor stage
function redraw_selected_building(cell_info) {

    if (cell_info === null || cell_info.building_data === null) {
        return;
    }

    // clear the editor stage
    editor_stage.destroyChildren();

    // create a new layer to draw the building on
    let editor_layer = new Konva.Layer();
    editor_stage.add(editor_layer);

    // draw the building on the editor stage
    draw_building(cell_info, editor_layer, false);

    // draw the building on the main stage
    draw_building(cell_info, building_layer, true);
}


// draw a given building: its shape and doors
function draw_building(cell_info, parent, for_main_stage) {
    
    // create a group to contain the building and its entrances
    let building_group = new Konva.Group();
    
    if (for_main_stage) {

        // remove previous shapes if they exist
        let prev_group = cell_info.shapes.building_group;
        if (prev_group !== null) {
            prev_group.destroy();
        }
    }

    // construct and draw the building shape
    draw_building_shape(cell_info, building_group, for_main_stage);

    // draw building corridors
    draw_corridors(cell_info, building_group, for_main_stage);

    // draw building entrances
    draw_entrances(cell_info, building_group, for_main_stage);

    // draw building outline
    draw_building_outline(cell_info, building_group, for_main_stage);

    // store main stage shapes
    if (for_main_stage) {
        cell_info.shapes.building_group = building_group;
    }

    // add the building group to the parent group / layer
    parent.add(building_group);
}


// draw the building shape for the building at the given coordinates
function draw_building_shape(cell_info, parent, for_main_stage) {

    // get grid cell info associated with the building
    let building_grid_coords = grid_coords_for_building_or_door(cell_info.building_data);
    let building_mods = cell_info.building_mods;

    // destroy previous building shape if there is one
    if (for_main_stage) {
        let prev_building_shape = cell_info.shapes.building;
        if (prev_building_shape !== null) {
            prev_building_shape.destroy();
        }
    }

    // convert the grid path to a path that can be used by the stage
    let grid_shape_path = building_mods.outline_grid_path;
    let stage_shape_path = grid_shape_path.map((point) => door_grid_coords_to_stage_coords(point, building_grid_coords, for_main_stage));
    stage_shape_path = flatten_points(stage_shape_path);

    let building_color = get_building_color(cell_info);

    // construct a building shape given the door coordinates and calculated corners
    let building_shape = new Konva.Line({
        points: stage_shape_path,
        fill: building_color,
        // stroke: 'black',
        // strokeWidth: building_stroke_width,
        closed: true,
        perfectDrawEnabled: false,
        // shadowBlur: cell_dims.size / 4,
        // shadowColor: "red",
    });
    parent.add(building_shape);

    // add necessary info about the building cell to the grid array
    if (for_main_stage) {
        cell_info.shapes.building = building_shape;
    }

    // TODO: remove entirely
    // add a clipping function to the building group to hide doors from appearing outside of building
    if (building_clipping_enabled && !for_main_stage) {
        parent.clipFunc(function(ctx) {
            ctx.beginPath();
            ctx.moveTo(stage_shape_path[0], stage_shape_path[1]);
    
            for (let i = 2; i < stage_shape_path.length - 1; i += 2) {
              ctx.lineTo(stage_shape_path[i], stage_shape_path[i+1]);
            }
    
            ctx.closePath();
        });
    }
}


// draw a shape to represent a building being selected
function draw_building_select_highlight(cell_info) {
    // TODO: implement this
}


// update the building shape color to a new color
function update_building_colors(cell_info) {

    let building_shape = cell_info.shapes.building;
    let corridors_group = cell_info.shapes.corridors_group;

    // update the building fill color
    if (building_shape !== null) {
        let building_color = get_building_color(cell_info);
        building_shape.fill(building_color);
    }

    // update the corridors color
    if (corridors_group !== null) {
        let corridors_color = get_corridor_color(cell_info);
        let corridors = corridors_group.getChildren();

        for (let i = 0; i < corridors.length; i++) {
            corridors[i].stroke(corridors_color);
        }
    }
}


// draw the building outline for the building at the given coordinates
function draw_building_outline(cell_info, parent, for_main_stage) {

    // get the grid cell info object associated with the building
    let building_grid_coords = grid_coords_for_building_or_door(cell_info.building_data);
    let building_mods = cell_info.building_mods;

    // destroy previous building outline if there is one
    if (for_main_stage) {
        let prev_building_outline = cell_info.shapes.building_outline;
        if (prev_building_outline !== null) {
            prev_building_outline.destroy();
        }
    }

    // convert the grid path to a path that can be used by the stage
    let grid_shape_path = building_mods.outline_grid_path;
    let stage_shape_path = grid_shape_path.map((point) => door_grid_coords_to_stage_coords(point, building_grid_coords, for_main_stage));

    // draw building outline (ensures doors have an outer border along the building shape)
    // let outline_color = building_mods.open ? "black" : "red";
    let outline_color = building_mods.open ? get_corridor_color(cell_info) : "red";
    let building_outline = new Konva.Line({
        points: flatten_points(stage_shape_path),
        stroke: outline_color,
        strokeWidth: get_cell_dims(for_main_stage).stroke,
        closed: true,
        listening: false, // needed for the editor layer to allow doors to be dragged
        perfectDrawEnabled: false
    });
    parent.add(building_outline);

    // store the building outline shape
    if (for_main_stage) {
        cell_info.shapes.building_outline = building_outline;
    }
}

// draw the doors for the building at the given coordinates
function draw_entrances(cell_info, parent, for_main_stage) {

    // get cell and door dimensions
    let cell_dims = get_cell_dims(for_main_stage);
    let door_dims = get_door_dims(for_main_stage);

    // get grid cell info associated with the building
    let building_grid_coords = grid_coords_for_building_or_door(cell_info.building_data);
    let building_mods = cell_info.building_mods;
    let door_mods = building_mods.entrance_mods;
    let doors = cell_info.building_data.entrances;
    let grid_shape_path = building_mods.outline_grid_path;

    let effective_grid_walls = cell_info.building_mods.effective_grid_walls;
    let effective_stage_walls = null;

    // create new entrances group
    let entrances_group = new Konva.Group();
    parent.add(entrances_group);

    // remove previous door shapes if they exist
    if (for_main_stage) {

        let prev_entrances_group = cell_info.shapes.entrances_group;
        if (prev_entrances_group !== null) {
            prev_entrances_group.destroy();
        }

        cell_info.shapes.entrances_group = entrances_group;
        cell_info.shapes.entrances = {};
    } else {
        cell_info.shapes.editor_entrances = {};

        // get stage coordinates dragging bounds
        effective_stage_walls = effective_grid_walls.map(function (line) {
    
            let stage_coords1 = door_grid_coords_to_stage_coords(line[0], building_grid_coords, false);
            let stage_coords2 = door_grid_coords_to_stage_coords(line[1], building_grid_coords, false);

            // offset by stroke size
            // let offset = door_dims.stroke * 1.5; // TODO: could make perfect with / 2, but I still want door outline to be partially hidden to not create visual bugs

            // let offset_stage_coords1 = calc_line_extend_point(stage_coords2, stage_coords1, offset);
            // let offset_stage_coords2 = calc_line_extend_point(stage_coords1, stage_coords2, offset);

            return [stage_coords1, stage_coords2];
        });
    }

    // define an array to determine door draw order
    let door_draw_order = [];

    // add doors to the draw order
    for (let door_id in door_mods) {
        let door_mod = door_mods[door_id];
        door_draw_order.push([door_mod.last_drag_time, door_mod["data_ref"]]);
    }

    // sort by last dragged timestamp to ensure the most last repositioned doors appear on top of other doors
    door_draw_order.sort(function (a, b) {

        let a_ts = a[0];
        let b_ts = b[0];

        if(a_ts > b_ts) return 1;
        if(a_ts < b_ts) return -1;
        return 0;
    });

    // different door colors for testing
    // let door_colors = ["red", "orange", "yellow", "green", "blue"]

    // iterate over every door in the draw order
    for (let d = 0; d < door_draw_order.length; d++) {
        
        let door = door_draw_order[d][1];
        let door_id = door["id"];
        let door_mod = door_mods[door_id];        
        
        // get door x and y coordinates (convert 1-indexed to 0-indexed)
        let door_grid_coords = grid_coords_for_building_or_door(door);

        // convert grid coordinates to stage coordinates
        let door_stage_coords = door_grid_coords_to_stage_coords(door_grid_coords, building_grid_coords, for_main_stage);
        
        let door_color = door["accessible"] == 1 ? "#005A9C" : "gray";
        let door_stroke_color = door_mod.open ? "black" : "red";

        let dir_door_dims = get_directional_door_dims(cell_info, door_id, for_main_stage);


        let door_shape = new Konva.Rect({
            width: dir_door_dims.width,
            height: dir_door_dims.height,
            fill: door_color,
            // fill: door_colors[d],
            stroke: door_stroke_color,
            strokeWidth: door_dims.stroke,
            x: dir_door_dims.x,
            y: dir_door_dims.y,
            perfectDrawEnabled: false,
            shadowForStrokeEnabled: false
        });
        
        if (for_main_stage) {
            
            // add necessary info about the building's doors to the grid array
            cell_info.shapes.entrances[door_id] = door_shape;

        } else {

            // add necessary info about the building's editor doors to the grid array
            cell_info.shapes.editor_entrances[door_id] = door_shape;

            // enable dragging to reposition doors in editor view
            door_shape.draggable(true);

            // add highlight shadow effect
            door_shape.shadowBlur(door_dims.size / 2);
            door_shape.shadowColor("black");
            door_shape.shadowEnabled(door_mod.editor_highlighted);

            // make the current dragged door always appear on top of other doors on drag start
            door_shape.on("dragstart", function (e) {
                door_shape.zIndex(door_draw_order.length - 1); 
                editor_is_dragging_door = true;

                // prevent editor from starting pan
                editor_pan_start_pointer_pos = null;
                editor_pan_start_stage_pos = null;
                editor_is_panning = false;
                editor_is_pan_attempted = false;
            });

            // lock the door's position to the building shape
            door_shape.on("dragmove", function (e) {

                // get the current shape position
                let curr_stage_coords = {
                    x: door_shape.x() + door_dims.size/2,
                    y: door_shape.y() + door_dims.size/2
                };

                // find the point closest to the shape from the current point
                let best_point_and_line = calc_closest_line_and_point_from_point_to_lines(effective_stage_walls, curr_stage_coords);
                let line_direction = calc_line_orthogonal_direction(best_point_and_line.line[0], best_point_and_line.line[1]);
                door_mod.wall_direction = line_direction;

                let best_wall_index = effective_stage_walls.indexOf(best_point_and_line.line);
                door_mod.attached_wall = effective_grid_walls[best_wall_index];

                // adjust the point to door top left coordinate rather than center
                let best_point_adjusted = {
                    x: best_point_and_line.point.x - door_dims.size/2,
                    y: best_point_and_line.point.y - door_dims.size/2
                };

                door_shape.position(best_point_adjusted);
            });

            // drag ended, update stages
            door_shape.on("dragend", function (e) {
                selected_door_moved(cell_info, door_id, e.target);
                editor_is_dragging_door = false;
            });
        }

        entrances_group.add(door_shape);
    }
}


// highlights the currently selected door or not by adding a shadow effect
function draw_entrance_highlight(cell_info, door_id, is_highlighting) {

    let door_shape = cell_info.shapes.editor_entrances[door_id];
    cell_info.building_mods.entrance_mods[door_id].editor_highlighted = is_highlighting;

    if (door_shape === null) {
        return;
    }

    // enable or disable the shadow
    door_shape.shadowEnabled(is_highlighting);
}


// draw corridors for the building at the given grid coordinates
function draw_corridors(cell_info, parent, for_main_stage) {

    let building_grid_coords = grid_coords_for_building_or_door(cell_info.building_data);
    let door_dims = get_door_dims(for_main_stage);
    let building_mods = cell_info.building_mods;
    let door_mods = building_mods.entrance_mods;
    let connection_mods = building_mods.connection_mods;

    let corridor_color = get_corridor_color(cell_info);
    let corridor_width = door_dims.size / 2;

    // create new corridors group
    let corridors_group = new Konva.Group();

    // remove previous corridors shapes if they exist
    if (for_main_stage) {

        let prev_corridors_group = cell_info.shapes.corridors_group;
        if (prev_corridors_group !== null) {
            prev_corridors_group.destroy();
        }

        cell_info.shapes.corridors_group = corridors_group;
    }

    // iterate over every stored corridor path 
    for (let i = 0; i < building_mods.corridor_all_grid_paths.length; i++) {

        let corridor_grid_path = building_mods.corridor_all_grid_paths[i];
        let corridor_stage_path = corridor_grid_path.map(coords => door_grid_coords_to_stage_coords(coords, building_grid_coords, for_main_stage));

        // draw the wall itself
        let corridor_line = new Konva.Line({
            points: flatten_points(corridor_stage_path),
            stroke: corridor_color,
            strokeWidth: corridor_width,
            perfectDrawEnabled: false,
        });
        corridors_group.add(corridor_line);
    }

    if (!building_corridors_enabled) {
        corridors_group.hide();
    }

    parent.add(corridors_group);
}


/* ------------------------------ road drawing ------------------------------ */


// combine consecutive road line parts into one line object
function consolidate_road_line_parts(line_parts) {

    let combined_lines = [];

    let prev_first_part = line_parts[0];
    for (let i = 1; i < line_parts.length; i++) {

        let cur_part = line_parts[i];

        // the end point of the previous part matches the start point of the current point, combine them
        if (coords_eq(prev_first_part.end, cur_part.start)) {
            prev_first_part.end = cur_part.end;
            prev_first_part.end_perpen_width_weight = cur_part.end_perpen_width_weight;
        
        // match was not found, add the first part to the lines list
        } else {
            combined_lines.push(prev_first_part);
            prev_first_part = cur_part;
        }
    }
    combined_lines.push(prev_first_part);

    return combined_lines;
}

// draws roads in the background 
function draw_roads(parent) {

    // reset the road layer
    road_layer.destroyChildren();

    // store which roads should be hidden for vertical and horizontal directions
    let horz_skips = [];
    let vert_skips = [];
    
    for (let i = 0; i < grid.length + 1; i++) {
        horz_skips.push([]);
        vert_skips.push([]);
    }

    // iterate over every grid cell
    for (let y = 0; y < grid.length; y++) {
        for (let x = 0; x < grid.length; x++) {

            let cell_info = grid_object_at_coords({x:x, y:y});
            let right_cell_info = grid_object_at_coords({x:x+1, y:y});
            let down_cell_info = grid_object_at_coords({x:x, y:y+1});

            // find two left/right empty cells or connected building cells -> vertical road skip
            if (cell_info !== null && right_cell_info !== null) {
                if (((cell_info.building_data === null && right_cell_info.building_data === null) && removed_roads_enabled) || (cell_info === right_cell_info && !removed_roads_thru_buildings_enabled)) {
                    vert_skips[x + 1].push(y);
                }
            }
            
            // find two up/down empty cells or connected building cells -> horizontal road skip
            if (cell_info !== null && down_cell_info !== null) {
                if (((cell_info.building_data === null && down_cell_info.building_data === null) && removed_roads_enabled) || (cell_info === down_cell_info && !removed_roads_thru_buildings_enabled)) {
                    horz_skips[y + 1].push(x);
                }
            }
        }
    }

    let horz_line_parts = [];
    let vert_line_parts = [];

    // TODO: probably a better way to do this rather than in two separate loops over the grid... (i do it to make consolidation easier)
    // iterate over every grid cell to calculate horizontal lines
    for (let y = 1; y < grid.length; y++) {
        for (let x = 0; x < grid.length; x++) {
            
            // calculate the starting point and end points for vertical and horizontal roads
            let start_point = { x: x, y: y };
            let horizontal_end_point = { x: x + 1, y: y };
            
            if (horz_skips[y].indexOf(x) === -1) {
                horz_line_parts.push({
                    start: start_point,
                    end: horizontal_end_point,
                    width_weight: horz_roads_rand_weights[y],
                    start_perpen_width_weight: vert_roads_rand_weights[x] || 1,
                    end_perpen_width_weight: vert_roads_rand_weights[x+1] || 1
                });
            }
        }
    }

    // iterate over every grid cell to calculate vertical lines
    for (let x = 1; x < grid.length; x++) {
        for (let y = 0; y < grid.length; y++) {
            
            // calculate the starting point and end points for vertical and horizontal roads
            let start_point = { x: x, y: y };
            let vertical_end_point = { x: x, y: y + 1};

            if (vert_skips[x].indexOf(y) === -1) {
                vert_line_parts.push({
                    start: start_point,
                    end: vertical_end_point,
                    width_weight: vert_roads_rand_weights[x],
                    start_perpen_width_weight: horz_roads_rand_weights[y] || 1,
                    end_perpen_width_weight: horz_roads_rand_weights[y+1] || 1
                });
            }
        }
    }

    // consolidate horizontal and vertical lines (combining consecutive parts into one line object)
    let horz_lines = consolidate_road_line_parts(horz_line_parts);
    let vert_lines = consolidate_road_line_parts(vert_line_parts);

    for (let d = 0; d <= 1; d++) {

        // draw background on first iteration, dashed lines on second iteration
        let is_dashed = d == 1;

        // draw vertical roads 
        vert_lines.forEach(function (road_line) {
            draw_road_line(road_line, is_dashed, true, parent);
        });

        // draw horizontal roads
        horz_lines.forEach(function (road_line) {
            draw_road_line(road_line, is_dashed, false, parent);
        });
    }
}

// draw a road background for a given start and end grid point
function draw_road_line(grid_road_line, is_dashed, is_vertical, parent) {

    let start_grid_point = grid_road_line.start;
    let end_grid_point = grid_road_line.end;
    let rand_road_weight = grid_road_line.width_weight;

    let cell_dims = get_cell_dims(true);
    let road_size = (cell_dims.size + cell_dims.spacing) * road_size_ratio;
    // let road_size = cell_dims.spacing;
    let dash_spacing = road_size / 2;
    let dash_size = ((cell_dims.size + cell_dims.spacing) - ((road_dashes_per_cell ) * dash_spacing)) / road_dashes_per_cell;

    // get weighted road size
    let rand_road_size = road_size * rand_road_weight;

    // get amount to offset dash in certain direction based on input (creates pluses at intersections)
    let dash_size_offset = is_dashed ? dash_size / 2 : 0;
    let dash_size_offset_x = !is_vertical ? dash_size_offset : 0;
    let dash_size_offset_y = is_vertical ? dash_size_offset : 0;

    // convert the given grid coords to stage coords
    let start_stage_point = grid_coords_to_main_stage_coords(start_grid_point);
    let end_stage_point = grid_coords_to_main_stage_coords(end_grid_point);

    // adjust stage coords to be offset by perpendicular road sizes at the start and end
    if (is_vertical) {
        if (!is_dashed) {
            start_stage_point.y -= road_size * grid_road_line.start_perpen_width_weight / 2;
        }
        end_stage_point.y += road_size * grid_road_line.end_perpen_width_weight / 2;
    } else {
        if (!is_dashed) {
            start_stage_point.x -= road_size * grid_road_line.start_perpen_width_weight / 2;
        }
        end_stage_point.x += road_size * grid_road_line.end_perpen_width_weight / 2;
    }

    // adjust stage coords to be in the middle of spacing
    start_stage_point = {
        x: start_stage_point.x - cell_dims.spacing/2 - dash_size_offset_x,
        y: start_stage_point.y - cell_dims.spacing/2 - dash_size_offset_y
    };

    end_stage_point = {
        x: end_stage_point.x - cell_dims.spacing/2,
        y: end_stage_point.y - cell_dims.spacing/2
    };

    let path = flatten_points([start_stage_point, end_stage_point]);

    // google maps road color 
    let road_background_color = "#AAB9C9";

    // pale yellow
    let road_dash_color = "#fffcc9";

    // determine drawing values
    let road_color = is_dashed ? road_dash_color : road_background_color;
    let stroke_width = is_dashed ?  road_size / 6 : rand_road_size;

    // create new road path
    let road = new Konva.Line({
        points: path,
        stroke: road_color,
        strokeWidth: stroke_width,
        closed: false,
        perfectDrawEnabled: false
    });

    if (is_dashed) {
        road.dash([dash_size, dash_spacing]);
    }

    parent.add(road);
}


/* ------------------------------ path drawing ------------------------------ */

// draw the current paths on the main stage
function draw_paths() {

    // reset the path layer
    path_layer.destroy();
    path_layer = new Konva.Layer();
    main_stage.add(path_layer);

    console.log("path mods: ", path_mods);

    // iterate over every current path
    for (let a = 0; a < path_algs.length; a++) {

        let alg = path_algs[a];
        let path_obj = current_paths[alg];
        let path_mod = path_mods[alg];

        // do not try to display paths that are not present
        if (!path_mod.has_data) {
            // console.log("no data for path: ", alg);
            continue;
        }

        let path_type = alg_path_types[alg]; // TODO: change how algorithm path types are selected?

        // create a group for each path
        let path_group = new Konva.Group();
        path_layer.add(path_group);
        path_mod.shape = path_group;

        // TODO: do this properly
        // check if there are no actual buildings in the path
        if (path_obj.path.length === 2) {

            let start_door = path_obj.path[0].entrances[0];
            let end_door = path_obj.path[1].entrances[0];

            // flip coords since path recommender comes reverse due to lon/lat vs x/y
            let start_point_grid_coords = {
                x: start_door.y - 1,
                y: start_door.x - 1
            };
            let end_point_grid_coords = {
                x: end_door.y - 1,
                y: end_door.x - 1
            };

            draw_endpoint_to_endpoint_path_part(start_point_grid_coords, end_point_grid_coords, path_group, path_type);
            continue;
        }

        // iterate over every building in the path
        for (let i = 0; i < path_obj.path.length - 1; i++) {

            let building1 = path_obj.path[i];
            let building2 = path_obj.path[i+1];
    
            let cell_info1 = grid_object_for_id(building1.id);
            let cell_info2 = grid_object_for_id(building2.id);

            // check for drawing starting path
            if (i === 0) {

                let start_door = building1.entrances[0];

                // flip coords since path recommender comes reverse due to lon/lat vs x/y
                let end_point_grid_coords = {
                    x: start_door.y - 1,
                    y: start_door.x - 1
                };

                draw_endpoint_path_part(end_point_grid_coords, cell_info2, building2.entrances[0].id, path_group, path_type);

            // check for drawing end path
            } else if (i + 1 === path_obj.path.length - 1) {

                let end_door = building2.entrances[0];

                // flip coords since path recommender comes reverse due to lon/lat vs x/y
                let end_point_grid_coords = {
                    x: end_door.y - 1,
                    y: end_door.x - 1
                };

                draw_endpoint_path_part(end_point_grid_coords, cell_info1, building1.entrances[0].id, path_group, path_type);

            // drawing path between or inside buildings
            } else {

                if (cell_info1 === null || cell_info2 === null) {
                    console.log("failed to draw path for: ", building1.id, cell_info1, building2.id, cell_info2);
                    continue;
                }
                
                // draw internal path if buildings have the same id
                if (building1.id === building2.id) {
                    draw_internal_path_part(cell_info1, building1.entrances[0].id, building2.entrances[0].id, path_group, path_type);
                } else {
                    draw_external_path_part(cell_info1, building1.entrances[0].id, cell_info2, building2.entrances[0].id, path_group, path_type);
                }
            }
        }
    }
}


// draws endpoints using currently stored points
function draw_path_endpoint_selections(parent) {

    if (path_start_selected_grid_coords !== null) {
        draw_point_selection(path_start_selected_grid_coords, parent, true);
    }

    if (path_end_selected_grid_coords !== null) {
        draw_point_selection(path_end_selected_grid_coords, parent, false);
    }
}


// draws a point at the location of selection
function draw_point_selection(door_grid_coords, parent, is_start) {

    let cell_dims = get_cell_dims(true);
    let selection_color = is_start ? selection_colors.path_start : selection_colors.path_end;
    let building_grid_coords = estimate_building_grid_coords(door_grid_coords);
    // console.log(selection_color);

    // remove the previous selection point shapes if they exist
    if (is_start && path_start_selection_shape !== null) {
        path_start_selection_shape.destroy();
    } else if (!is_start && path_end_selection_shape !== null) {
        path_end_selection_shape.destroy();
    }

    let stage_coords = door_grid_coords_to_stage_coords(door_grid_coords, building_grid_coords, true);
    
    let endpoint_circle = new Konva.Circle({
        x: stage_coords.x,
        y: stage_coords.y,
        radius: cell_dims.size * endpoint_selection_size_ratio,
        // fill: "red",
        // fill: "rgba(255, 0, 0, 0.5)",
        stroke: selection_color,
        strokeWidth: cell_dims.size * endpoint_selection_size_ratio / 2
    });

    if (is_start) {
        path_start_selection_shape = endpoint_circle;
    } else {
        path_end_selection_shape = endpoint_circle;
    }

    parent.add(endpoint_circle);
}


// draw path directly between endpoint and endpoint
function draw_endpoint_to_endpoint_path_part(start_point_grid_coords, end_point_grid_coords, parent, path_type) {
    
    // TODO: could probably combine this with the other endpoint drawing method, lots of duplicated code...
    // honestly you should just separate the endpoint to border based on location out to another method, that's the big part

    let cell_dims = get_cell_dims(true);
    let door_dims = get_door_dims(true);

    // get path drawing options 
    let path_options = path_type_options[path_type];
    let path_color = show_path_type_color ? path_options.color : "red";
    let path_width = door_dims.size / 5;
    let path_grid_offset = path_options.exterior_offset * (path_width / cell_dims.size * 1.25);
    let door_grid_offset = (path_options.exterior_offset - 3) * (path_width / cell_dims.size);

    // get statuses and information for the endpoints
    let start_point_location_status = get_endpoint_location_status(start_point_grid_coords);
    let start_point_building_grid_coords = estimate_building_grid_coords(start_point_grid_coords);
    let start_point_building_id = grid_coords_to_building_id(start_point_building_grid_coords);

    let end_point_location_status = get_endpoint_location_status(end_point_grid_coords);
    let end_point_building_grid_coords = estimate_building_grid_coords(end_point_grid_coords);
    let end_point_building_id = grid_coords_to_building_id(end_point_building_grid_coords);

    // get to border results for the endpoints
    let start_point_to_border_results = null;
    let end_point_to_border_results = null
    
    // start point is outside grid
    if (start_point_location_status === 0) {
        let grid_border_grid_coords = closest_cell_coords_for_out_of_bounds(start_point_building_grid_coords);
        start_point_building_id = grid_coords_to_building_id(grid_border_grid_coords);
        start_point_to_border_results = endpoint_grid_path_to_border(grid_border_grid_coords, start_point_grid_coords, 
            path_grid_offset, door_grid_offset);
    
    // start point is inside grid, outside building
    } else if (start_point_location_status === 1) {
        start_point_to_border_results = endpoint_grid_path_to_border(start_point_building_grid_coords, start_point_grid_coords, 
            path_grid_offset, door_grid_offset, end_point_building_grid_coords);
    
    // start point is inside building
    } else if (start_point_location_status === 2) {

        // TODO: need to properly connect endpoint to door point, since currently it is just a straight line

        let start_point_cell_info = grid_object_for_id(start_point_building_id);

        let best_dist = Number.MAX_SAFE_INTEGER;
        let best_door = null;

        // find closest door to target 
        for (let i = 0; i < start_point_cell_info.building_data.entrances.length; i++) {
            let start_point_door = start_point_cell_info.building_data.entrances[i];
            let start_point_door_grid_coords = grid_coords_for_building_or_door(start_point_door);

            let dist = calc_dist(start_point_door_grid_coords, end_point_building_grid_coords);

            if (dist < best_dist) {
                best_dist = dist;
                best_door = start_point_door;
            }
        }

        // check if a best door was found
        if (best_door !== null) {
            start_point_to_border_results = door_grid_path_to_border(start_point_cell_info, best_door.id, path_grid_offset, door_grid_offset);
        } else {
            start_point_to_border_results = endpoint_grid_path_to_border(start_point_building_grid_coords, start_point_door_grid_coords, 
                path_grid_offset, door_grid_offset, end_point_building_grid_coords);
        }
    }

    // end point is outside grid
    if (end_point_location_status === 0) {
        let grid_border_grid_coords = closest_cell_coords_for_out_of_bounds(end_point_building_grid_coords);
        end_point_building_id = grid_coords_to_building_id(grid_border_grid_coords);
        end_point_to_border_results = endpoint_grid_path_to_border(grid_border_grid_coords, end_point_grid_coords, 
            path_grid_offset, door_grid_offset);
    
    // end point is inside grid, outside building
    } else if (end_point_location_status === 1) {
        end_point_to_border_results = endpoint_grid_path_to_border(end_point_building_grid_coords, end_point_grid_coords, 
            path_grid_offset, door_grid_offset, end_point_building_grid_coords);
    
    // end point is inside building
    } else if (end_point_location_status === 2) {

        // TODO: need to properly connect endpoint to door point, since currently it is just a straight line

        let end_point_cell_info = grid_object_for_id(end_point_building_id);

        let best_dist = Number.MAX_SAFE_INTEGER;
        let best_door = null;

        // find closest door to target 
        for (let i = 0; i < end_point_cell_info.building_data.entrances.length; i++) {
            let end_point_door = end_point_cell_info.building_data.entrances[i];
            let end_point_door_grid_coords = grid_coords_for_building_or_door(end_point_door);

            let dist = calc_dist(end_point_door_grid_coords, start_point_building_grid_coords);

            if (dist < best_dist) {
                best_dist = dist;
                best_door = end_point_door;
            }
        }

        // check if a best door was found
        if (best_door !== null) {
            end_point_to_border_results = door_grid_path_to_border(end_point_cell_info, best_door.id, path_grid_offset, door_grid_offset);
        } else {
            end_point_to_border_results = endpoint_grid_path_to_border(end_point_building_grid_coords, end_point_door_grid_coords, 
                path_grid_offset, door_grid_offset, start_point_building_grid_coords);
        }
    }

    // find the path that connects the border walls for each cell
    let connected_wall_grid_path = connect_building_cell_walls_grid_path(start_point_building_id, start_point_to_border_results.wall_dir, 
        end_point_building_id, end_point_to_border_results.wall_dir, end_point_to_border_results.path[1], path_grid_offset);
        
    // remove first and last point to allow walls to end at cutoff points
    connected_wall_grid_path.shift();
    connected_wall_grid_path.pop();

    // construct grid path and convert to stage coords
    let external_grid_path = [start_point_grid_coords, ...start_point_to_border_results.path, ...connected_wall_grid_path, ...end_point_to_border_results.path.toReversed(), end_point_grid_coords];
    let external_stage_path = external_grid_path.map((grid_coords) => door_grid_coords_to_main_stage_coords(grid_coords, null, true));

    // create the shape for the external path
    let external_path_shape = new Konva.Line({
        points: flatten_points(external_stage_path),
        stroke: path_color,
        strokeWidth: path_width,
        perfectDrawEnabled: false,
        lineCap: path_line_cap,
        lineJoin: path_line_join,
    });

    // set the line dash style if necessary
    let path_dash = get_main_stage_path_dash(path_type);
    if (path_dash !== null) {
        external_path_shape.dash(path_dash);
    }

    parent.add(external_path_shape);
}


// draw path between an endpoint and building
function draw_endpoint_path_part(endpoint_door_grid_coords, cell_info, door_id, parent, path_type) {

    let cell_dims = get_cell_dims(true);
    let door_dims = get_door_dims(true);

    // get path drawing options 
    let path_options = path_type_options[path_type];
    let path_color = show_path_type_color ? path_options.color : "red";
    let path_width = door_dims.size / 5;
    let path_grid_offset = path_options.exterior_offset * (path_width / cell_dims.size * 1.25);
    let door_grid_offset = (path_options.exterior_offset - 3) * (path_width / cell_dims.size);

    // get statuses and information for the endpoint
    let endpoint_location_status = get_endpoint_location_status(endpoint_door_grid_coords);
    let endpoint_building_grid_coords = estimate_building_grid_coords(endpoint_door_grid_coords);
    let endpoint_building_id = grid_coords_to_building_id(endpoint_building_grid_coords);
    
    // get the path from door and endpoint to cell border
    let door_to_border_results = door_grid_path_to_border(cell_info, door_id, path_grid_offset, door_grid_offset);
    let endpoint_to_border_results = null;
    
    // get target building and door information
    let target_door_grid_coords = grid_coords_for_building_or_door(cell_info.building_mods.entrance_mods[door_id].data_ref);
    let target_building_id = grid_coords_to_building_id(estimate_building_grid_coords(door_to_border_results.path[0]));

    // endpoint is outside grid
    if (endpoint_location_status === 0) {
        let grid_border_grid_coords = closest_cell_coords_for_out_of_bounds(endpoint_building_grid_coords);
        endpoint_building_id = grid_coords_to_building_id(grid_border_grid_coords);
        endpoint_to_border_results = endpoint_grid_path_to_border(grid_border_grid_coords, endpoint_door_grid_coords, 
            path_grid_offset, door_grid_offset);
    
    // endpoint is inside grid, outside building
    } else if (endpoint_location_status === 1) {
        endpoint_to_border_results = endpoint_grid_path_to_border(endpoint_building_grid_coords, endpoint_door_grid_coords, 
            path_grid_offset, door_grid_offset, door_to_border_results.path[1]);
    
    // endpoint is inside building
    } else if (endpoint_location_status === 2) {

        // TODO: need to properly connect endpoint to door point, since currently it is just a straight line

        let endpoint_cell_info = grid_object_for_id(endpoint_building_id);

        let best_dist = Number.MAX_SAFE_INTEGER;
        let best_door = null;

        // find closest door to target 
        for (let i = 0; i < endpoint_cell_info.building_data.entrances.length; i++) {
            let endpoint_door = endpoint_cell_info.building_data.entrances[i];
            let endpoint_door_grid_coords = grid_coords_for_building_or_door(endpoint_door);

            let dist = calc_dist(endpoint_door_grid_coords, door_to_border_results.path[1]);

            if (dist < best_dist) {
                best_dist = dist;
                best_door = endpoint_door;
            }
        }

        // check if a best door was found
        if (best_door !== null) {
            endpoint_to_border_results = door_grid_path_to_border(endpoint_cell_info, best_door.id, path_grid_offset, door_grid_offset);
        } else {
            endpoint_to_border_results = endpoint_grid_path_to_border(endpoint_building_grid_coords, endpoint_door_grid_coords, 
                path_grid_offset, door_grid_offset, door_to_border_results.path[1]);
        }
    }

    // find the path that connects the border walls for each cell
    let connected_wall_grid_path = connect_building_cell_walls_grid_path(endpoint_building_id, endpoint_to_border_results.wall_dir, 
        target_building_id, door_to_border_results.wall_dir, door_to_border_results.path[1], path_grid_offset);
        
    // remove first and last point to allow walls to end at cutoff points
    connected_wall_grid_path.shift();
    connected_wall_grid_path.pop();

    // construct grid path and convert to stage coords
    let external_grid_path = [endpoint_door_grid_coords, ...endpoint_to_border_results.path, ...connected_wall_grid_path, ...door_to_border_results.path.toReversed(), target_door_grid_coords];
    let external_stage_path = external_grid_path.map((grid_coords) => door_grid_coords_to_main_stage_coords(grid_coords, null, true));

    // create the shape for the external path
    let external_path_shape = new Konva.Line({
        points: flatten_points(external_stage_path),
        stroke: path_color,
        strokeWidth: path_width,
        perfectDrawEnabled: false,
        lineCap: path_line_cap,
        lineJoin: path_line_join,
    });

    // set the line dash style if necessary
    let path_dash = get_main_stage_path_dash(path_type);
    if (path_dash !== null) {
        external_path_shape.dash(path_dash);
    }

    parent.add(external_path_shape);
}

// draw external path from a given building to another building
function draw_external_path_part(cell1_info, door1_id, cell2_info, door2_id, parent, path_type) {

    // console.log("external path: ", path_type, "building1: ", building1_grid_coords, "door1: ", door1_grid_coords, "building2_grid_coords: ", building2_grid_coords, "door2: ", door2_grid_coords);

    // get grid coords for each door
    let door1_mods = cell1_info.building_mods.entrance_mods[door1_id];
    door1_grid_coords = grid_coords_for_building_or_door(door1_mods.data_ref);
    building1_grid_coords = estimate_building_grid_coords(door1_grid_coords);
    
    let door2_mods = cell2_info.building_mods.entrance_mods[door2_id];
    door2_grid_coords = grid_coords_for_building_or_door(door2_mods.data_ref);
    building2_grid_coords = estimate_building_grid_coords(door2_grid_coords);

    // console.log("external path adjusted coords: building1: ", building1_grid_coords, "door1: ", door1_grid_coords, "building2_grid_coords: ", building2_grid_coords, "door2: ", door2_grid_coords);

    let building1_id = grid_coords_to_building_id(estimate_building_grid_coords(door1_grid_coords));
    let building2_id = grid_coords_to_building_id(estimate_building_grid_coords(door2_grid_coords));

    let cell_dims = get_cell_dims(true);
    let door_dims = get_door_dims(true);

    // get path drawing options 
    let path_options = path_type_options[path_type];
    let path_color = show_path_type_color ? path_options.color : "red";
    let path_width = door_dims.size / 5;
    let path_grid_offset = path_options.exterior_offset * (path_width / cell_dims.size * 1.25);
    let door_grid_offset = (path_options.exterior_offset - 3) * (path_width / cell_dims.size);

    // don't offset door grid coords if there is only one path through the door
    let door1_grid_offset = cell1_info !== null && door1_id !== null && cell1_info.building_mods.entrance_mods[door1_id].path_count === 1 ? 0 : door_grid_offset;
    let door2_grid_offset = cell2_info !== null && door2_id !== null && cell2_info.building_mods.entrance_mods[door2_id].path_count === 1 ? 0 : door_grid_offset;

    // calculate points straight from door to cell border
    let door1_to_border_results = door_grid_path_to_border(cell1_info, door1_id, path_grid_offset, door1_grid_offset);
    let door2_to_border_results = door_grid_path_to_border(cell2_info, door2_id, path_grid_offset, door2_grid_offset);

    // find the path that connects the border walls for each cell
    let connected_wall_grid_path = connect_building_cell_walls_grid_path(building1_id, door1_to_border_results.wall_dir, building2_id, door2_to_border_results.wall_dir, door2_to_border_results.path[1], path_grid_offset);

    // remove first and last point to allow walls to end at cutoff points
    connected_wall_grid_path.shift();
    connected_wall_grid_path.pop();

    // construct the grid path then convert to stage coords
    let external_grid_path = [door1_grid_coords, ...door1_to_border_results.path, ...connected_wall_grid_path, ...door2_to_border_results.path.toReversed(), door2_grid_coords];
    let external_stage_path = external_grid_path.map((grid_coords) => door_grid_coords_to_main_stage_coords(grid_coords, null, true));

    // create the shape for the external path
    let external_path_shape = new Konva.Line({
        points: flatten_points(external_stage_path),
        stroke: path_color,
        strokeWidth: path_width,
        perfectDrawEnabled: false,
        lineCap: path_line_cap,
        lineJoin: path_line_join,
    });

    // set the line dash style if necessary
    let path_dash = get_main_stage_path_dash(path_type);
    if (path_dash !== null) {
        external_path_shape.dash(path_dash);
    }

    parent.add(external_path_shape);
}


// draw internal path from one door to another of a given building
function draw_internal_path_part(cell_info, door1_id, door2_id, parent, path_type) {

    let building_grid_coords = grid_coords_for_building_or_door(cell_info.building_data);
    let door_dims = get_door_dims(true);
    let door_mods = cell_info.building_mods.entrance_mods;

    // console.log("internal path: building1: ", building_grid_coords, "door1: ", door1_id, "door2: ", door2_id);

    // get path display options
    let path_options = path_type_options[path_type];
    let path_color = show_path_type_color ? path_options.color : "green";
    let path_width = door_dims.size / 5;

    // get the path from each door to the center point
    let door1_to_center = door_mods[door1_id].corridor_path;
    let door2_to_center = door_mods[door2_id].corridor_path;

    // extract coordinates into variables for ease of reading
    let door1_grid_coords = door1_to_center[0];
    let door1_middle_grid_coords = door1_to_center[1];
    let door2_grid_coords = door2_to_center[0];
    let door2_middle_grid_coords = door2_to_center[1];
    let center1_grid_coords = door1_to_center[2];
    let center2_grid_coords = door2_to_center[2];

    let full_grid_path = null;

    // only one building is connected, there are no center lines
    if (Object.keys(cell_info.building_mods.connection_mods).length === 1) {

        // check if the lines from the doors to the middle line intersect
        let door_intersection = calc_lines_intersection([door1_grid_coords, door1_middle_grid_coords], [door2_grid_coords, door2_middle_grid_coords]);
    
        if (door_intersection !== null) {
            full_grid_path = [door1_grid_coords, door_intersection, door2_grid_coords];
    
        // check if either doors' middle coords are in a straight line to the center
        } else if (points_are_in_straight_line(door1_middle_grid_coords, door2_middle_grid_coords, center1_grid_coords) ||
                   points_are_in_straight_line(door2_middle_grid_coords, door1_middle_grid_coords, center1_grid_coords)) {
            full_grid_path = [door1_grid_coords, door1_middle_grid_coords, door2_middle_grid_coords, door2_grid_coords];
        } else {
            full_grid_path = [door1_grid_coords, door1_middle_grid_coords, center1_grid_coords, center2_grid_coords, door2_middle_grid_coords, door2_grid_coords];
        }
    
    // at least 2 buildings, need to find path through center lines
    } else {

        let centers_connected_path = connect_door_grid_center_path(cell_info, door1_id, door2_id);
        // console.log("connected path: ", connected_path);

        full_grid_path = [door1_grid_coords, door1_middle_grid_coords, ...centers_connected_path, door2_middle_grid_coords, door2_grid_coords];
    }



    // convert internal path to stage coordinates
    let full_stage_path = full_grid_path.map((grid_point) => door_grid_coords_to_stage_coords(grid_point, building_grid_coords, true));

    let internal_path_shape = new Konva.Line({
        points: flatten_points(full_stage_path),
        stroke: path_color,
        strokeWidth: path_width,
        perfectDrawEnabled: false,
        lineCap: path_line_cap,
        lineJoin: path_line_join,
        opacity: 0.5
    });

    // draw a certain dash type if necessary
    let path_dash = get_main_stage_path_dash(path_type);
    if (path_dash !== null) {
        internal_path_shape.dash(path_dash);
    }

    parent.add(internal_path_shape);
}
