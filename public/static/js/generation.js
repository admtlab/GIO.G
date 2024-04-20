
/* ---------------------- building and door generation ---------------------- */


// generates a congestion array using a given config
function generate_congestion(config, con_level_override) {

    // get values from config
    let is_constant = config["constant_con"];
    let low_con_perc = config["low_con"];
    let med_con_perc = config["med_con"];
    
    let con_avg = 0;

    // congestion override provided
    if (con_level_override !== null) {
        con_avg = rand_gaussian(con_vals[con_level_override], con_std_dev);
    
    // no override, check if constant congestion enabled or not
    } else if (is_constant) {
        con_avg = con_vals["constant"];

    // variable random congestion
    } else {

        let rand = Math.random();

        // randomly selected high congestion
        if (rand > low_con_perc + med_con_perc) {
            con_avg = rand_gaussian(con_vals["high"], con_std_dev);

        // randomly selected med congestion
        } else if (rand > low_con_perc) {
            con_avg = rand_gaussian(con_vals["med"], con_std_dev);

        // randomly selected low congestion
        } else {
            con_avg = rand_gaussian(con_vals["low"], con_std_dev);
        }
    }

    // determine the min and max possible values of the congestion
    let min = is_constant ? 80 : Math.abs(con_avg - con_std_dev * 2);
    let max = is_constant ? 120 : con_avg + con_std_dev * 2;

    let cons = [];

    // write congestion for every 5 min window of a 24hr day
    for (let i = 0; i < 288; i++) {
        let lower = i * 5;
        let upper = lower + 5;

        // create congestion object
        let con = {
            id: i,
            timestep: i,
            lower: lower,
            upper: upper,
            min: min,
            max: max,
            avg: con_avg,
            stdDev: con_std_dev
        };
        cons.push(con);
    }

    return cons;
}


// detect the congestion level from a given array of congestion objects
function determine_con_level(congestion) {

    let con_avg = congestion[0]["avg"];

    // find the number of standard deviations away from the avg each congestion level is
    let high_std_devs = Math.abs(con_vals["high"] - con_avg) / con_std_dev;
    let med_std_devs = Math.abs(con_vals["med"] - con_avg) / con_std_dev;
    let low_std_devs = Math.abs(con_vals["low"] - con_avg) / con_std_dev;

    // construct an array to get the minimum std and its associated name
    let std_devs = [[high_std_devs, "high"], [med_std_devs, "med"], [low_std_devs, "low"]];
    let sorted_std_devs = std_devs.sort((a, b) => a[0] - b[0]);

    // return the name of congestion that's the lowest number of standard deviations away
    return sorted_std_devs[0][1];
}


// creates a list of building doors with the provided information (they are just generated, not added to any data structure)
function generate_new_doors(building_grid_coords, num_doors, door_id_start) {

    let doors = [];
    let angle_partition = 360 / num_doors;

    for (let i = 0; i < num_doors; i++) {
        let door_r = rand_in_range(0.25, 0.45); // ensures doors are not too close to the center nor outside the grid cell
        let door_theta = (i * angle_partition + rand_in_range(0, angle_partition)) * (Math.PI / 180); // convert to radians from degrees
        
        let door_graph_coords = {
            x: building_grid_coords.x + door_r * Math.cos(door_theta) + 1, // convert polar coordinates to area around building, and 
            y: building_grid_coords.y + door_r * Math.sin(door_theta) + 1  // add 1 to convert from 0-indexed to 1-indexed
        };

        let accessibility = Math.random() > 0.5 ? 1 : 0;

        // create new door object
        let door = {
            id: door_id_start + i,
            x: door_graph_coords.x,
            y: door_graph_coords.y,
            accessible: accessibility
        };

        doors.push(door);
    }

    return doors;
}


// creates a new building object with the provided information
function generate_building(building_grid_coords) {
    
    // initialize new building object
    let building = {
        id: grid_coords_to_building_id(building_grid_coords),
        x: building_grid_coords.x + 1, // convert from 0-indexed to 1-indexed
        y: building_grid_coords.y + 1,
        congestion: generate_congestion(current_config, null), 
        entrances: generate_new_doors(building_grid_coords, rand_int_in_range(3, 6), 1)
    };

    // update coordinates of any deep doors from the building (they cause issues with shape generation)
    update_deep_doors(building);

    return building;
}


// adds a new door to the given building
function add_new_building_door(cell_info) {

    console.log("add door to building: ", cell_info);

    let building_grid_coords = grid_coords_for_building_or_door(cell_info.building_data);
    let building_mods = cell_info.building_mods;
    let door_id = building_mods.next_new_door_id++;

    // randomly select one of the merged buildings to generate the door for
    let possible_building_grid_coords = [building_grid_coords, ...building_mods.connected_building_coords.map(coords => grid_coords_for_building_or_door(coords))];
    let rand_building_grid_coords = possible_building_grid_coords[Math.round(Math.random() * (possible_building_grid_coords.length - 1))];
 
    // generate a new door object
    let door = generate_new_doors(rand_building_grid_coords, 1, door_id)[0];
    let door_grid_coords = grid_coords_for_building_or_door(door);

    // get the closest wall location to the current location
    let best_point_and_line = calc_closest_line_and_point_from_point_to_lines(building_mods.effective_grid_walls, door_grid_coords);
    let line_direction = calc_line_orthogonal_direction(best_point_and_line.line[0], best_point_and_line.line[1]);

    // set door's new coordinates (and convert index back to 1-indexed)
    door.x = best_point_and_line.point.x + 1;
    door.y = best_point_and_line.point.y + 1;

    // create a new door modification object
    let door_mod =  {
        open: true,
        data_ref: door,
        last_drag_time: 0,
        wall_direction: line_direction,
        attached_wall: best_point_and_line.line,
        editor_highlighted: false
    };

    // add new door structures to grid data
    cell_info.building_data.entrances.push(door);
    building_mods.entrance_mods[door_id] = door_mod;

    // calculate door orientation 
    find_door_orientation(cell_info, door_id);

    return door_id
}


// deletes a given door from the given building
function delete_building_door(cell_info, door_id) {
    
    let doors = cell_info.building_data.entrances;

    // iterate over the doors array
    for (let d = 0; d < doors.length; d++) {
        let door = doors[d];

        if (door["id"] == door_id) {

            // remove the door from the doors array
            doors.splice(d, 1);
            break;
        }
    }

    // remove the door from the building modifications doors array
    delete cell_info.building_mods.entrance_mods[door_id];
}


// creates a new building at the given coords
function add_new_building(building_grid_coords) {

    // get the current grid cell info
    let cell_info = grid_object_at_coords(building_grid_coords);

    // if there is a building at the given location, delete it first
    if (cell_info.building_data !== null) {
        delete_building(cell_info);
    }

    // create a new building object
    let building = generate_building(building_grid_coords);

    // initialize data structures used by and need by the building
    process_building(building);

    // add the new building to the graph data
    current_graph.push(building);
}


// deletes a building at the given coords 
function delete_building(cell_info) {

    let building = cell_info.building_data;

    // remove the building from the graph data
    let building_index = current_graph.indexOf(building);
    current_graph.splice(building_index, 1);

    // reset the building cell for any connected buildings
    let connected_buildings = cell_info.building_mods.connected_building_coords;
    if (connected_buildings != null) {
        for (let i = 0; i < connected_buildings.length; i++) {
            let connected_coords = grid_coords_for_building_or_door(connected_buildings[i]);
            grid[connected_coords.y][connected_coords.x] = new_empty_grid_cell();
        }
    }

    // reset the main building cell
    let main_building_coords = grid_coords_for_building_or_door(building);
    grid[main_building_coords.y][main_building_coords.x] = new_empty_grid_cell();

    // reset connection button status
    if (is_selecting_new_connection) {
        is_selecting_new_connection = false;
        new_connection_start_cell_info = null;
        update_new_connection_button_active();
    }
}
