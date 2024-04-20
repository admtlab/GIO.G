
/* -------------------------------------------------------------------------- */
/*                               building editor                              */
/* -------------------------------------------------------------------------- */


// clear the building editor stage and selected building info
function reset_building_editor(reset_editor_pos) {

    // get selected building elements
    let info_text_container = document.getElementById("selected-cell-info-text-container");
    let doors_list_container = document.getElementById("selected-building-doors-container");
    let building_options_container = document.getElementById("selected-building-options-container");
    let building_actions_container = document.getElementById("selected-building-actions-container");

    // clear elements relevant to the previous selected building
    info_text_container.innerHTML = "";
    doors_list_container.innerHTML = "";
    building_options_container.innerHTML = "";
    building_actions_container.innerHTML = "";

    info_text_container.style.display = "none";
    doors_list_container.style.display = "none";
    building_options_container.style.display = "none";
    building_actions_container.style.display = "none";

    // clear the editor stage
    editor_stage.destroyChildren();

    // reset editor stage zooming and panning
    if (reset_editor_pos) {
        editor_stage.scaleX(1);
        editor_stage.scaleY(1);
        editor_stage.position({x:0, y:0});
    }
}


// select a building at the given coordinates and open it in the editor
function select_building_to_edit(building_grid_coords, can_unselect, reset_editor_pos) {

    console.log("selecting cell to edit: ", building_grid_coords);

    // get the info object for the building at the given coords
    let cell_info = grid_object_at_coords(building_grid_coords);

    if (cell_info === null) {
        console.log("can't select building, cell_info null");
        return;
    }

    console.log("cell info:", cell_info);

    // reset the building editor elements
    reset_building_editor(reset_editor_pos);

    // unselect if clicked same building (by doing nothing)
    if (editor_selected_cell_info !== null && cell_info === editor_selected_cell_info && can_unselect) {
        console.log("unselecting", editor_selected_cell_info);
        editor_selected_cell_info = null;
        return;
    }

    // recalculate editor drawing dimensions
    calculate_editor_draw_dims(cell_info);

    // automatically open the building editor if enabled
    if (auto_open_sections_enabled) {
        set_accordion_opened("building-editor-accordion-button", true);
    }

    // set the currently selected editor selected grid cell
    editor_selected_cell_info = cell_info;
    editor_selected_grid_coords = building_grid_coords;

    // get container elements to build elements into
    let info_text_container = document.getElementById("selected-cell-info-text-container");
    let doors_list_container = document.getElementById("selected-building-doors-container");
    let building_options_container = document.getElementById("selected-building-options-container");
    let building_actions_container = document.getElementById("selected-building-actions-container");

    // create content for the current selected grid cell
    let cell_info_label = document.createElement("span");
    cell_info_label.classList.add("subsubtitle");
    cell_info_label.innerHTML = "Grid Cell: ";
    info_text_container.appendChild(cell_info_label);
    
    let cell_info_content = document.createElement("span");
    cell_info_content.innerHTML = `(${building_grid_coords.x + 1}, ${building_grid_coords.y + 1})  `;
    info_text_container.appendChild(cell_info_content);

    // set display styles for elements that appear for empty or non-empty cells
    info_text_container.style.display = "";
    building_actions_container.style.display = "";
    
    // check if a building is present in the grid cell
    if (cell_info.building_data !== null) {

        doors_list_container.style.display = "block";
        building_options_container.style.display = "block";

        let building_id = cell_info.building_data["id"];
        let doors = cell_info.building_data.entrances;

        // create a span to show the building id
        let building_info_label = document.createElement("span");
        building_info_label.classList.add("subsubtitle");
        building_info_label.innerHTML = "Building ID:  ";
        info_text_container.appendChild(building_info_label);
    
        let building_info_content = document.createElement("span");
        building_info_content.innerHTML = building_id;
        info_text_container.appendChild(building_info_content);

        // create a div to contain the title and add doors button
        let edit_doors_title_container = document.createElement("div");
        doors_list_container.appendChild(edit_doors_title_container);

        // create a title for the edit doors list
        let edit_doors_list_title = document.createElement("span");
        edit_doors_list_title.classList.add("subsubtitle");
        edit_doors_list_title.innerHTML = "Doors:";
        edit_doors_title_container.appendChild(edit_doors_list_title);

        // create container for the add door button
        let add_door_button_container = document.createElement("span");
        add_door_button_container.id = "edit-doors-add-button-container";
        edit_doors_title_container.appendChild(add_door_button_container);
        
        // create a button that adds a door to the current building
        let add_door_button = document.createElement("button");
        add_door_button.innerHTML = "+ Door";
        add_door_button.classList.add("standard-button");
        add_door_button.addEventListener("click", function (e) {
            handle_add_door_button(cell_info);
        });
        add_door_button_container.appendChild(add_door_button);

        // create list to store door info in
        let edit_doors_list = document.createElement("ul");
        edit_doors_list.setAttribute("id", "edit-doors-list");
        
        // iterate over every door in the building
        for (let door_id in cell_info.building_mods.entrance_mods) {
            let door_list_item = create_door_list_item(cell_info, door_id);
            edit_doors_list.appendChild(door_list_item);
        }
        doors_list_container.appendChild(edit_doors_list);

        // create label and radio buttons to represent open or closed status for the building
        let building_open_container = document.createElement("div");
        building_options_container.appendChild(building_open_container);

        let building_open_title = document.createElement("span");
        building_open_title.classList.add("subsubtitle");
        building_open_title.innerHTML = "Availability:";
        building_open_container.appendChild(building_open_title);

        // create span wrapped radios and labels for open / closed status
        let open_radio = create_open_radio(cell_info, "open");
        let closed_radio = create_open_radio(cell_info, "closed");
        building_open_container.appendChild(open_radio);
        building_open_container.appendChild(closed_radio);

        // create label and input checkbox to represent whether the building is open or closed (i.e. usable or not)        
        let building_open_label = document.createElement("label");
        building_open_label.innerHTML = "Open";
        building_open_label.htmlFor = "building-open-cb";

        // only show congestion radio if the graph does not use constant congestion
        if (!current_config["constant_con"]) {

            // TODO: still show for constant congestion? since you want to be able to edit it?
            // or at least update how you check for this, since if you import a graph or use a preset it will not match the current config

            // create a container for the congestion radio element
            let building_con_container = document.createElement("div");
            building_con_container.id = "building-con-container";
            building_options_container.appendChild(building_con_container);

            // create labels and input radios to select building congestion level
            let building_con_label = document.createElement("span");
            building_con_label.classList.add("subsubtitle");
            building_con_label.innerHTML = "Congestion:";
            building_con_container.appendChild(building_con_label);

            // create span wrapped radios and label for each congestion level
            let low_con_radio = create_con_radio(cell_info, "low");
            let med_con_radio = create_con_radio(cell_info, "med");
            let high_con_radio = create_con_radio(cell_info, "high");

            building_con_container.appendChild(low_con_radio);
            building_con_container.appendChild(med_con_radio);
            building_con_container.appendChild(high_con_radio);
        }
        
        // create a button to delete the current building
        let delete_building_button = document.createElement("button");
        delete_building_button.innerHTML = "Delete Building";
        // delete_building_button.classList.add("delete-text");
        delete_building_button.classList.add("standard-button");
        delete_building_button.addEventListener("click", function (e) {
            handle_delete_building_button(cell_info);
        });
        building_actions_container.appendChild(delete_building_button);

        // create a button to connect with another building
        let connect_building_button = document.createElement("button");
        connect_building_button.id = "select-building-connection-button";
        connect_building_button.innerHTML = "Select New Connection";
        connect_building_button.classList.add("standard-button");
        connect_building_button.addEventListener("click", function (e) {
            handle_select_connect_building_button(cell_info);
        });
        building_actions_container.appendChild(connect_building_button);
        
    } else {

        // create a button to create a new
        let add_building_button = document.createElement("button");
        add_building_button.innerHTML = "Create Building";
        add_building_button.classList.add("standard-button");
        add_building_button.addEventListener("click", function (e) {
            handle_add_building_button(building_grid_coords);
        });
        building_actions_container.appendChild(add_building_button);
    }

    // redraw the selected building in both the editor stage and main stage
    if (cell_info.building_data !== null) {
        redraw_selected_building(cell_info);
    }

    // update accordion heights
    update_accordion_heights();
}


// returns a new list item for a given door at a given building
function create_door_list_item(cell_info, door_id) {

    let door = door_object_for_id(cell_info, door_id);
    let door_mod = cell_info.building_mods.entrance_mods[door_id];

    // create a list item to contain door properties
    let li = document.createElement("li");
    li.classList.add("edit-doors-list-item");
    li.id = `door-${door_id}-list-item`

    // ID label to identify each door
    let door_label = document.createElement("span");
    door_label.innerHTML = "ID: ";
    door_label.classList.add("bold-text");

    let door_label_value = document.createElement("span");
    door_label_value.innerHTML = door_id;

    // define ids for different checkboxes
    let open_chkbox_id = `door-${door_id}-open-cb`;
    let access_chkbox_id = `door-${door_id}-accessible-cb`;

    // define span to group parts of the list item
    let open_span = document.createElement("span");
    open_span.classList.add("options-short-group");
    open_span.classList.add("edit-doors-list-item-control");

    let access_span = document.createElement("span");
    access_span.classList.add("options-short-group");
    access_span.classList.add("edit-doors-list-item-control");

    let delete_span = document.createElement("span");
    delete_span.classList.add("options-short-group");
    delete_span.classList.add("edit-doors-list-item-control");
    
    // create label and input checkbox to represent whether a door is open or closed (i.e. usable or not)        
    let open_label = document.createElement("label");
    open_label.innerHTML = "Open";
    open_label.htmlFor = open_chkbox_id;

    let open_chkbox = document.createElement("input");
    open_chkbox.type = "checkbox";
    open_chkbox.id = open_chkbox_id;
    open_chkbox.checked = door_mod.open;
    open_chkbox.addEventListener("change", function(e) {
        door_open_checkbox_checked(cell_info, door_id);
    });
    
    // create label and input checkbox to represent whether a door is accessible or not
    let access_label = document.createElement("label");
    access_label.innerHTML = "Accessible";
    access_label.htmlFor = access_chkbox_id;

    let access_chkbox = document.createElement("input");
    access_chkbox.type = "checkbox";
    access_chkbox.id = access_chkbox_id;
    access_chkbox.checked = door["accessible"];
    access_chkbox.addEventListener("change", function(e) {
        door_accessible_checkbox_checked(cell_info, door_id);
    });

    // create button to delete the door
    let delete_button = document.createElement("button");
    delete_button.innerHTML = "Delete";
    delete_button.classList.add("edit-doors-list-item-control");
    delete_button.classList.add("standard-button");
    delete_button.addEventListener("click", function (e) {
        handle_delete_door_button(cell_info, door_id);
    });
    // delete_trash_icon = document.createElement("i");
    // delete_trash_icon.classList.add("material-icons");
    // delete_trash_icon.innerHTML = "delete";
    // delete_button.appendChild(delete_trash_icon);

    // add created items as children to the list item
    li.appendChild(door_label);
    li.appendChild(door_label_value);
    open_span.appendChild(open_chkbox);
    open_span.appendChild(open_label);
    li.appendChild(open_span);
    access_span.appendChild(access_chkbox);
    access_span.appendChild(access_label);
    li.appendChild(access_span);
    delete_span.appendChild(delete_button);
    li.appendChild(delete_span);

    // add event listeners to highlight given door or not when mousing over the list item
    li.addEventListener("mouseenter", function(e) {
        draw_entrance_highlight(cell_info, door_id, true);
    });
    li.addEventListener("mouseleave", function(e) {
        draw_entrance_highlight(cell_info, door_id, false);
    });

    return li;
}


// creates a radio option and label for congestion level for a given building
function create_con_radio(cell_info, con_level) {

    let building_mods = cell_info.building_mods;

    let con_radio_id = `building-${con_level}-con-radio`;
    
    // create container for the radio and label
    let span = document.createElement("span");
    span.classList.add("options-short-group");

    // create label for the radio
    let con_label = document.createElement("label");
    con_label.htmlFor = con_radio_id;
    con_label.innerHTML = con_level_names[con_level];

    // create the radio button 
    let con_radio = document.createElement("input");
    con_radio.type = "radio";
    con_radio.classList.add(con_text_color_classes[con_level]);
    con_radio.id = con_radio_id;
    con_radio.checked = building_mods.con_level === con_level;
    con_radio.name = "con_level";
    con_radio.addEventListener("change", function(e) {
        if (this.checked) {
            building_con_radio_checked(cell_info, con_level);
        }
    });
    
    // add radio button and text to the label
    span.appendChild(con_radio);
    span.appendChild(con_label);

    return span;
}


// creates a radio option and label for building openness status
function create_open_radio(cell_info, openness) {

    let building_mods = cell_info.building_mods;

    let openness_id = `building-availability-${openness}`;

    // create container for the radio and label
    let span = document.createElement("span");
    span.classList.add("options-short-group");

    // create label for the radio
    let label = document.createElement("label");
    label.htmlFor = openness_id;
    label.innerHTML = openness.charAt(0).toUpperCase() + openness.slice(1);;

    // create the radio button 
    let radio = document.createElement("input");
    radio.type = "radio";
    radio.id = openness_id;
    radio.checked = (building_mods.open && openness === "open") || (!building_mods.open && openness === "closed");
    radio.name = "building-availability";
    radio.addEventListener("change", function(e) {
        if (this.checked) {
            building_open_radio_changed(cell_info, openness);
        }
    });

    // add radio button and text to the label
    span.appendChild(radio);
    span.appendChild(label);

    return span;
}

/* ------------------------ building options handlers ----------------------- */


// handle the selected building delete button click
function handle_delete_building_button(cell_info) {

    console.log("building deleted: ", cell_info);

    let building_grid_coords = grid_coords_for_building_or_door(cell_info.building_data);

    // delete the building group from the main stage
    let group = cell_info.shapes.building_group;
    if (group !== null) {
        group.destroy();
    }

    // remove the building from the graph & grid data structures
    delete_building(cell_info);

    // reselect the empty cell
    select_building_to_edit(building_grid_coords, false, false);

    // redraw roads considering new building
    draw_roads(road_layer);
}

// handle the selected empty grid cell add button click
function handle_add_building_button(building_grid_coords) {

    console.log("building added: ", building_grid_coords);

    // create a new building object
    add_new_building(building_grid_coords);

    // get the cell info for the new building
    let cell_info = grid_object_at_coords(building_grid_coords);

    // draw the building on the main stage
    draw_building(cell_info, building_layer, true);

    // reselect the filled cell
    select_building_to_edit(building_grid_coords, false, false);
    
    // redraw roads considering new building
    draw_roads(road_layer);
}


// handle the selected building open checkbox being changed
function building_open_radio_changed(cell_info, openness) {

    // get the information for the given building
    let building = cell_info.building_data;
    let building_mods = cell_info.building_mods;

    // assign the new open status to the building
    building_mods.open = openness === "open";
    
    // redraw the building to reflect the changes in accessibility
    redraw_selected_building(cell_info);
}


// handle the selected building congestion radio being checked
function building_con_radio_checked(cell_info, con_level) {
    console.log("new con level: ", con_level);

    // get the information for the given building
    let building = cell_info.building_data;
    let building_mods = cell_info.building_mods;

    // generate new congestion based on the given value
    let new_con = generate_congestion(current_config, con_level);

    // update building data
    building.congestion = new_con;
    building.congestion_type = con_level;
    building_mods.con_level = con_level;

    // redraw the building to reflect the changes in congestion
    redraw_selected_building(cell_info);
}


// handle the selected building being chosen for another building to connect to button
function handle_select_connect_building_button(cell_info) {

    // toggle the variables for currently selecting
    is_selecting_new_connection = !is_selecting_new_connection;
    is_selecting_path_end = false;
    is_selecting_path_start = false;

    // update button selection classes
    update_path_select_buttons_active();
    update_new_connection_button_active();

    // set the start building
    new_connection_start_cell_info = cell_info;
}


// update the connect new building button selection status
function update_new_connection_button_active() {
    let connection_button = document.getElementById("select-building-connection-button");
    if (connection_button !== null) {
        if (is_selecting_new_connection) {
            connection_button.classList.add("toggle-button-active");
        } else {
            connection_button.classList.remove("toggle-button-active");
        }
    }
}


/* -------------------------- door options handlers ------------------------- */


// handle dragging an entrance in the drag editor
function selected_door_moved(cell_info, door_id, editor_door_shape) {

    let door = door_object_for_id(cell_info, door_id);
    let building_grid_coords = grid_coords_for_building_or_door(cell_info.building_data);
    let door_mods = cell_info.building_mods.entrance_mods
    let door_mod = door_mods[door_id];

    // get the editor stage coordinates of the moved door shape
    let new_door_stage_coords = {
        x: editor_door_shape.x() + editor_door_shape.width()/2, // +size/2 since rects are positioned from top left corner rather than center
        y: editor_door_shape.y() + editor_door_shape.height()/2
    };

    // convert the stage coordinates to grid coordinates
    let new_door_grid_coords = door_stage_coords_to_grid_coords(new_door_stage_coords, building_grid_coords, false);

    // set the door's new coordinates (convert back from 0-indexed to 1-indexed)
    door.x = new_door_grid_coords.x + 1;
    door.y = new_door_grid_coords.y + 1;

    // log this door as being the last dragged door for this building (so it is drawn on top of other doors)
    door_mod.last_drag_time = Date.now();

    // find new door orientation
    find_door_orientation(cell_info, door_id);
    console.log("building: ", cell_info.building_data.id, "door: ", door_id, "moved! new orientation: ", door_mod.orientation);

    // recalculate door corridors
    calculate_building_corridors(cell_info);
    
    // redraw the building to reflect the changes in position
    redraw_selected_building(cell_info);
}


// handle the open checkbox being clicked for a given building door
function door_open_checkbox_checked(cell_info, door_id) {

    let door_mod = cell_info.building_mods.entrance_mods[door_id];

    // toggle the door's open status
    door_mod.open = !door_mod.open;
    
    // redraw the building to reflect the changes in accessibility
    redraw_selected_building(cell_info);
}


// handle the accessible checkbox being clicked for a given building door
function door_accessible_checkbox_checked(cell_info, door_id) {

    let door = door_object_for_id(cell_info, door_id);

    // get the previous accessibility status
    let prev_access = door["accessible"];
    let new_access = Math.abs(prev_access - 1); // flips 0 to 1 and 1 to 0

    // assign the new accessibility status to the door
    door["accessible"] = new_access;
    
    // redraw the building to reflect the changes in accessibility
    redraw_selected_building(cell_info);
}


// remove the door with the given id from the given buildling
function handle_delete_door_button(cell_info, door_id) {
    console.log("delete door: ", cell_info, door_id);

    // remove the door from the grid data structure
    delete_building_door(cell_info, door_id);

    // remove the door list item from the editor
    let li = document.getElementById(`door-${door_id}-list-item`);
    li.parentNode.removeChild(li);

    // recalculate door corridors
    calculate_building_corridors(cell_info);

    // redraw the building to reflect the changes in doors
    redraw_selected_building(cell_info);

    // update accordian heights
    update_accordion_heights();
}


// adds a new door to the given building 
function handle_add_door_button(cell_info) {
    console.log("add door: ", cell_info);

    // add a new door to the grid data structure
    let door_id = add_new_building_door(cell_info);
 
    // add a new door list item to the editor list
    let li = create_door_list_item(cell_info, door_id);
    let ul = document.getElementById("edit-doors-list");
    ul.appendChild(li);

    // recalculate door corridors
    calculate_building_corridors(cell_info);

    // redraw the building to display the new door
    redraw_selected_building(cell_info);

    // update accordian heights
    update_accordion_heights();
}
