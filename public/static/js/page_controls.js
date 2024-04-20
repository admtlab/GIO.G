
/* -------------------------------------------------------------------------- */
/*                                page controls                               */
/* -------------------------------------------------------------------------- */


/* ----------------------- preset graph form controls ----------------------- */


// handle submit button pressed on load preset graph form
function submit_load_graph_preset() {

    // get the selected graph file value
    let graph_select = document.getElementById("preset-graph-select-input");
    let graph_file = graph_select.value;

    // don't submit empty option
    if (graph_file === "") {
        alert("Please select a preset from the list");
        return;
    }

    load_preset_graph(graph_file);
}


// ensure that the preset selection resets on page refresh
function update_preset_select_display(select_value) {
    
    let graph_select = document.getElementById("preset-graph-select-input");
    graph_select.value = select_value;
}


/* ----------------------- import/export form controls ---------------------- */


// process a graph file from user input
function submit_uploaded_graph() {

    let import_input = document.getElementById("import-graph-input");

    // check if a file has been selected
    if (import_input.files.length === 0) {
        alert("ERROR: Choose a file to upload");
    }

    let file = import_input.files[0];

    // set up the file reader
    let reader = new FileReader();
    reader.onload = event => process_uploaded_graph(event.target.result)
    // reader.onerror = error => reject(error)

    // read the uploaded file
    reader.readAsText(file)
}


// download an export file of the current graph
function download_graph_export() {

    // determine whether or not to prettify the export data
    let pretty_chkbox = document.getElementById("export-pretty-cb");
    let json_spaces = pretty_chkbox.checked ? 2 : 0;

    // get the current graph data (includes closed doors and buildings, as well as buildings with < 2 doors)
    let filtered_graph = filter_current_graph(true, true);

    // setup the file data and name
    let data = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(filtered_graph, null, json_spaces));
    let file_name = "graph_export.json";

    // create temporary link node
    let download_node = document.createElement('a');
    download_node.setAttribute("href", data);
    download_node.setAttribute("download", file_name);
    document.body.appendChild(download_node);
    
    // click the node to download the file, then remove the node from the body
    download_node.click();
    download_node.remove();
}


/* -------------------------- config form controls -------------------------- */


// set up accordion buttons after page load
function setup_accordion_buttons() {
    
    // add event listeners to each accordion button
    Array.from(document.getElementsByClassName("accordion-button")).forEach(function (button) {

        let panel = button.nextElementSibling;
        
        // set panel transition here so that it animates every time except for initially expanded nodes on page load
        panel.style.transition = "max-height 0.3s ease-out";

        button.addEventListener("click", function() {
            this.classList.toggle("accordion-active");

            if (panel.style.maxHeight) {
                panel.style.maxHeight = null;
            } else {
                panel.style.maxHeight = panel.scrollHeight + panel.offsetHeight + "px";
            } 
        });
    });
    
    update_accordion_heights();
}


// update all accordion heights 
function update_accordion_heights() {
    
    Array.from(document.getElementsByClassName("accordion-button")).forEach(function (button) {
        
        let panel = button.nextElementSibling;
        
        // set the max height of the panel
        if (button.classList.contains("accordion-active")) {
            panel.style.maxHeight = panel.scrollHeight + "px";
        } else {
            panel.style.maxHeight = null;
        } 
    });
}


// set up the graph gen config forms
function setup_graph_gen_form() {
    
    // create congestion multi thumb slider
    create_congestion_slider();

    // show any necessary values on the config form
    update_graph_gen_form_display();
    
    // detect when changes are made to the config form
    document.getElementById("config-form-container").addEventListener("input", function (e) {
        update_graph_gen_form_display();
    });
}


// update config form visuals based on the input values
function update_graph_gen_form_display() {

    let config_form = document.getElementById("config-form-container");
    let range_inputs = config_form.querySelectorAll("input[type=range]");

    // iterate over every range input in the form
    for (let i = 0; i < range_inputs.length; i++) {
        
        // set the percentage label for each range input
        let range_input = range_inputs[i];
        let perc_label = range_input.nextElementSibling;
        perc_label.innerHTML = Math.round(range_input.value * 100) + "%";
    }

    // enable or disable the congestion slider depending on if constant congestion is enabled
    let constant_con_input = document.getElementById("constant-congestion-input");
    let con_slider = document.getElementById("congestion-slider");
    let con_levels_labels_container = document.getElementById("congestion-labels-values-container");
    let con_slider_label = document.getElementById("congestion-slider-label");
    let con_levels_percents = con_levels_labels_container.querySelectorAll(".congestion-value-percent");

    if (constant_con_input.checked) {
        con_slider.setAttribute("disabled", "");
        con_levels_labels_container.style.opacity = "0.5";
        con_slider_label.style.opacity = "0.5";
    } else {
        con_slider.removeAttribute("disabled");
        con_levels_labels_container.style.opacity = "1";
        con_slider_label.style.opacity = "1";
    }

    Array.from(con_levels_percents).forEach(function (percent_label) {
        if (constant_con_input.checked) {
            percent_label.classList.add("black-text-color");
        } else {
            percent_label.classList.remove("black-text-color");
        }
    });
}


// attempt to submit the configuration form
function submit_graph_gen_form() {

    // get the input elements
    let num_buildings_input = document.getElementById("num-buildings-input");
    let coverage_input = document.getElementById("coverage-input");
    let clustering_input = document.getElementById("clustering-input");
    let constant_con_input = document.getElementById("constant-congestion-input");

    // convert input elements to proper types
    let num_buildings_value = parseInt(num_buildings_input.value, 10);
    let coverage_value = parseFloat(coverage_input.value);
    let clustering_value = parseFloat(clustering_input.value);

    let constant_con_value = constant_con_input.checked;
    let high_con_value = next_config_con_values.high / 100;
    let med_con_value = next_config_con_values.med / 100;
    let low_con_value = next_config_con_values.low / 100;

    // perform basic input validation
    let has_error = false;
    let error_message = "";

    // check the number of buildings
    if (num_buildings_value <= 0 || isNaN(num_buildings_value)) {
        has_error = true;
        error_message += "ERROR: Number of buildings must be at least 1<br>";
    }

    // verify that the congestion values sum to one
    let con_sum = high_con_value + med_con_value + low_con_value;
    if (Math.abs(con_sum - 1) > 0.00001) {
        has_error = true;
        error_message += "ERROR: High, Medium, and Low congestion values must sum to 100%<br>";
    }

    // set error text
    document.getElementById("graph-gen-error-text").innerHTML = error_message;
    
    // update accordion section heights
    update_accordion_heights();

    // do not continue if there is an error
    if (has_error) {
        return;
    }

    // construct a config object based on the input values
    let new_config = {
        num_buildings: num_buildings_value,
        coverage: coverage_value,
        clustering: clustering_value,
        constant_congestion: constant_con_value,
        high_con: high_con_value,
        med_con: med_con_value,
        low_con: low_con_value 
    };

    // generate a new graph with the given config
    generate_graph(new_config);
}


// create the multi thumb slider for congestion levels
function create_congestion_slider() {
    
    let con_slider = document.getElementById("congestion-slider");

    // create the noUiSlider 
    noUiSlider.create(con_slider, {
        start: [30, 70],
        range: { min: [0], max: [100] },
        step: 1,
        connect: [true, true, true]
    });

    // update display and current congestion values whenver a value has changed
    con_slider.noUiSlider.on("update", function (values, handle) {
        update_config_con_labels(values);
    });
    
    // color the different connections of the slider
    let connect = con_slider.querySelectorAll('.noUi-connect');
    let classes = ["low-con-color", "med-con-color", "high-con-color"];

    for (let i = 0; i < connect.length; i++) {
        connect[i].classList.add(classes[i]);
    }
}


// update the labels for congestion level %s
function update_config_con_labels(handle_values) {

    // calculate each of the congestion values
    let low_val = parseInt(handle_values[0]);
    let high_val = 100 - parseInt(handle_values[1]);
    let med_val = 100 - (high_val + low_val);

    // get the labels for each of the congestion levels
    let low_label = document.getElementById("low-con-value");
    let med_label = document.getElementById("med-con-value");
    let high_label = document.getElementById("high-con-value");

    // set the values of the labels
    low_label.innerHTML = low_val + "%";
    med_label.innerHTML = med_val + "%";
    high_label.innerHTML = high_val + "%";

    // store the congestion values
    next_config_con_values.low = low_val;
    next_config_con_values.med = med_val;
    next_config_con_values.high = high_val;
}


/* ------------------------- path gen form controls ------------------------- */


// attempt to submit the path generation form
function submit_path_gen_form() {

    let path_gen_form = document.getElementById("path-gen-form-container");
    let alg_chkboxes = path_gen_form.querySelectorAll("input[type=checkbox]");
    let access_radio_value = path_gen_form.querySelector("input[name=accessibility-type]:checked").value;

    let selected_algs = [];
    let start_x = null;
    let start_y = null;
    let end_x = null;
    let end_y = null;

    // iterate over every checkbox in the form and return the value of selected algs
    for (let i = 0; i < alg_chkboxes.length; i++) {
    
        let chkbox = alg_chkboxes[i];
        
        if (chkbox.checked) {
            selected_algs.push(chkbox.value);
        }
    }

    let error_message = "";
    let has_error = false;

    // check that at least one algorithm is selected
    if (selected_algs.length === 0) {
        error_message += "ERROR: Select at least one algorithm<br>";
        has_error = true;
    }

    // check if there is a selected start cell
    if (path_start_selected_grid_coords === null) {
        error_message += "ERROR: Select a start point<br>";
        has_error = true;
    } else {
        start_x = path_start_selected_grid_coords.x + 1;
        start_y = path_start_selected_grid_coords.y + 1;
    }

    // check if there is a selected end cell
    if (path_end_selected_grid_coords === null) {
        error_message += "ERROR: Select an end point<br>"
        has_error = true;
    } else {
        end_x = path_end_selected_grid_coords.x + 1;
        end_y = path_end_selected_grid_coords.y + 1;
    }

    // set error text
    document.getElementById("path-gen-error-text").innerHTML = error_message;

    // update accordion section heights
    update_accordion_heights();

    // do not continue if there is an error
    if (has_error) {
        return;
    }

    // create an object containing the path recommendation options
    let path_config = {
        accessible: access_radio_value === "accessible",
        start_x: start_x,
        start_y: start_y,
        end_x: end_x,
        end_y: end_y
    };

    let path_configs = selected_algs.map((alg) => {
        let config = {...path_config};
        config.algorithm = alg;
        return config;
    });

    // visualize returned paths
    recommend_paths(path_configs);
}


// update the path start and end selection info text
function update_path_select_labels() {

    let start_text = "(,)";
    let end_text = "(,)";
    
    // get the id of the currently selected start cell
    if (path_start_selected_grid_coords !== null) {
        // let start_cell_id = grid_cell_id_for_coords(path_start_selected_grid_coords);
        start_text = `(${path_start_selected_grid_coords.x.toFixed(1)}, ${path_start_selected_grid_coords.y.toFixed(1)})`;
    }

    // get the id of the currently selected end cell
    if (path_end_selected_grid_coords !== null) {
        end_text = `(${path_end_selected_grid_coords.x.toFixed(1)}, ${path_end_selected_grid_coords.y.toFixed(1)})`;
    }
    
    // get path start and end point info elements
    let start_coord_info = document.getElementById("path-start-building-info");
    let end_coord_info = document.getElementById("path-end-building-info");
    let start_label = document.getElementById("path-start-building-label");
    let end_label = document.getElementById("path-end-building-label");

    // set start and end point text and temporarily reset width
    start_coord_info.innerHTML = start_text;
    end_coord_info.innerHTML = end_text;
    start_coord_info.style.width = "";
    end_coord_info.style.width = "";
    start_label.style.width = "";
    end_label.style.width = "";

    // find out which info text is longer
    let max_value_width = start_coord_info.offsetWidth > end_coord_info.offsetWidth ? start_coord_info.offsetWidth : end_coord_info.offsetWidth;
    start_coord_info.style.width = max_value_width + "px";
    end_coord_info.style.width = max_value_width + "px";
    
    // find the value text that is longer
    let max_label_width = start_label.offsetWidth > end_label.offsetWidth ? start_label.offsetWidth : end_label.offsetWidth;
    start_label.style.width = max_label_width + "px";
    end_label.style.width = max_label_width + "px";

    update_accordion_heights();
}


// update the path start and end selection buttons to be active or not
function update_path_select_buttons_active() {

    let start_button = document.getElementById("select-path-start-button");
    let end_button = document.getElementById("select-path-end-button");

    if (is_selecting_path_start) {
        start_button.classList.add("toggle-button-active");
    } else {
        start_button.classList.remove("toggle-button-active");
    }

    if (is_selecting_path_end) {
        end_button.classList.add("toggle-button-active");
    } else {
        end_button.classList.remove("toggle-button-active");
    }
}


// begin selecting path start cell
function handle_select_start_building_button() {

    // toggle the variables for currently selecting start / end
    is_selecting_path_start = !is_selecting_path_start;
    is_selecting_path_end = false;
    is_selecting_new_connection = false;

    // update selection buttons colors
    update_path_select_buttons_active();
    update_new_connection_button_active();
}


// begin selecting path end cell
function handle_select_end_building_button() {
    
    // toggle the variables for currently selecting start / end
    is_selecting_path_end = !is_selecting_path_end;
    is_selecting_path_start = false;
    is_selecting_new_connection = false;

    // update selection buttons colors
    update_path_select_buttons_active();
    update_new_connection_button_active();
}


/* ----------------------------- display options ---------------------------- */


// updates the active class of the various toggle buttons
function update_toggle_buttons_active() {

    // display options
    update_toggle_button_active(document.getElementById("toggle-buildings-button"), building_layer.visible());
    update_toggle_button_active(document.getElementById("toggle-corridors-button"), building_corridors_enabled);
    update_toggle_button_active(document.getElementById("toggle-paths-button"), path_layer.visible());
    update_toggle_button_active(document.getElementById("toggle-all-roads-button"), road_layer.visible());
    update_toggle_button_active(document.getElementById("toggle-removed-roads-button"), removed_roads_enabled);
    update_toggle_button_active(document.getElementById("toggle-con-colors-button"), building_con_colors_enabled);
    update_toggle_button_active(document.getElementById("toggle-selection-highlights-button"), highlight_colors_enabled);
    update_toggle_button_active(document.getElementById("toggle-path-endpoints-button"), path_endpoints_enabled);
    update_toggle_button_active(document.getElementById("toggle-auto-sections-button"), auto_open_sections_enabled);
    update_toggle_button_active(document.getElementById("toggle-auto-endpoint-button"), auto_reset_path_endpoints_enabled);

    // developer options
    update_toggle_button_active(document.getElementById("toggle-clipping-button"), building_clipping_enabled);
    update_toggle_button_active(document.getElementById("toggle-pan-button"), can_pan_enabled);
    update_toggle_button_active(document.getElementById("toggle-zoom-button"), can_zoom_enabled);
    update_toggle_button_active(document.getElementById("toggle-about-multi-button"), about_page_multi_select_enabled);
}


// sets the toggle active class of a specific button based on the given value
function update_toggle_button_active(button, is_active) {
    
    if (button === null) {
        return;
    }

    // currently using the inverse.. looks better on page load since they're all selected at first
    if (!is_active) { 
        button.classList.add("toggle-button-active");
    } else {
        button.classList.remove("toggle-button-active");
    }
}


// buildings visibility toggle
function handle_buildings_visible_button(button) {

    if (building_layer.visible()) {
        building_layer.hide();
    } else {
        building_layer.show();
    }

    update_toggle_button_active(button, building_layer.visible());
}


// roads visibility toggle
function handle_roads_visible_button(button) {
    if (road_layer.visible()) {
        road_layer.hide();
    } else {
        road_layer.show();
    }

    update_toggle_buttons_active(button, road_layer.visible());
}


// removed roads visibility toggle
function handle_removed_roads_visible_button(button) {
    removed_roads_enabled = !removed_roads_enabled;

    draw_roads(road_layer);

    update_toggle_buttons_active(button, removed_roads_enabled);
}


// paths visibility toggle
function handle_paths_visible_button(button) {
    if (path_layer.visible()) {
        path_layer.hide();
    } else {
        path_layer.show();
    }

    update_toggle_buttons_active(button, path_layer.visible());
}


// building clipping toggle
function handle_clipping_visible_button(button) {

    // TODO: probably a better way to do this, but it's just a test method so..

    // toggle the clipping boolean
    building_clipping_enabled = !building_clipping_enabled;

    // redraw every building on the main stage
    for (let x = 0; x < grid.length; x++) {
        for (let y = 0; y < grid.length; y++) {
            
            let cell_info = grid[y][x];
            if (cell_info.building_data === null) {
                continue;
            }
            
            draw_building(cell_info, building_layer, true);
        }
    }

    // redraw the building in the editor
    redraw_selected_building(editor_selected_cell_info);

    update_toggle_buttons_active(button, building_clipping_enabled);
}


// building corridors toggle
function handle_corridors_visible_button(button) {
    
    // find the corridor group of every building and toggle it visible or not visible
    for (let x = 0; x < grid.length; x++) {
        for (let y = 0; y < grid.length; y++) {
            
            let cell_info = grid[y][x];
            if (cell_info.building_data === null) {
                continue;
            }
            
            let corridors_group = cell_info.shapes.corridors_group;
            if (building_corridors_enabled) {
                corridors_group.hide();
            } else {
                corridors_group.show();
            }
        }
    }

    building_corridors_enabled = !building_corridors_enabled;

    redraw_selected_building(editor_selected_cell_info);

    update_toggle_buttons_active(button, building_clipping_enabled);
}


// congestion colors visibility toggle
function handle_congestion_colors_button(button) {

    // toggle the colors boolean
    building_con_colors_enabled = !building_con_colors_enabled;

    // update the building color for every current building
    for (let x = 0; x < grid.length; x++) {
        for (let y = 0; y < grid.length; y++) {
            
            let cell_info = grid[y][x];
            if (cell_info.building_data === null) {
                continue;
            }
            
            update_building_colors(cell_info);
        }
    }

    redraw_selected_building(editor_selected_cell_info);

    update_toggle_buttons_active(button, building_con_colors_enabled);
}


// selected cell highlight colors visibility toggle
function handle_cell_highlights_visible_button(button) {

    // TODO: change for just selected building highlight

    // toggle the highlight color boolean
    highlight_colors_enabled = !highlight_colors_enabled;

    // update the highlight color for every cell
    // for (let x = 0; x < grid.length; x++) {
    //     for (let y = 0; y < grid.length; y++) {
            
    //         let cell_info = grid[y][x];
    //         if (cell_info.shapes.selection_overlay === null) {
    //             continue;
    //         }

    //         set_overlay_highlight({x:x, y:y}, null);
    //     }
    // }

    update_toggle_buttons_active();
}


// handle path end points visibility toggle
function handle_path_endpoint_visibility_button(button) {

    if (path_endpoints_enabled) {
        if (path_start_selection_shape) {
            path_start_selection_shape.hide();
        }
        if (path_end_selection_shape) {
            path_end_selection_shape.hide();
        }
    } else {
        if (path_start_selection_shape) {
            path_start_selection_shape.show();
        }
        if (path_end_selection_shape) {
            path_end_selection_shape.show();
        }
    }

    path_endpoints_enabled = !path_endpoints_enabled;

    update_toggle_buttons_active(button, path_endpoints_enabled);
}


// toggles the can pan variable
function handle_panning_toggle_button(button) {
    can_pan_enabled = !can_pan_enabled;

    update_toggle_buttons_active(button, can_pan_enabled);
}


// toggles the can zoom variable
function handle_zooming_toggle_button(button) {
    can_zoom_enabled = !can_zoom_enabled;

    update_toggle_buttons_active(button, can_zoom_enabled);
}


// toggles building editor auto open variable
function handle_auto_open_button(button) {
    auto_open_sections_enabled = !auto_open_sections_enabled;

    update_toggle_buttons_active(button, auto_open_sections_enabled);
}


// toggles auto reset path endpoint variable
function handle_auto_path_endpoint_reset_button(button) {
    auto_reset_path_endpoints_enabled = !auto_reset_path_endpoints_enabled;

    update_toggle_buttons_active(button, auto_reset_path_endpoints_enabled);
}


/* -------------------------- path legend and stats ------------------------- */


// updates all path sidebar elements
function update_path_display_sections() {
    // set the initial values for the path selection buttons (in path recommendation config)
    update_path_select_labels();

    // set the widths for each legend name
    update_path_legend_title_widths();

    // update active display statuses for paths in the legend
    update_path_legend_active_paths();

    // update the path stats tables
    update_path_stats_tables();
}


// update the path legend widths 
function update_path_legend_title_widths() {

    let legend_titles = document.querySelectorAll(".graph-legend-item-name");
    let max_width = Number.MIN_SAFE_INTEGER;

    legend_titles.forEach(function (element) {
        if (element.offsetWidth > max_width) {
            max_width = element.offsetWidth;
        }
    });
    
    legend_titles.forEach(function (element) {
        element.style.width = max_width + 5 + "px";
    });
}


// update path legend for current paths
function update_path_legend_active_paths() {

    // set the disabled class status for each algorithm legend item
    for (let alg in path_mods) {
        let path_mod = path_mods[alg];
        let legend_item = document.getElementById(`graph-legend-item-${alg}`);;

        if (path_mod.has_data) {
            legend_item.classList.remove("graph-legend-item-disabled");
        } else {
            legend_item.classList.add("graph-legend-item-disabled");
        }

        // set the checkbox status of each item
        let display_cb = legend_item.querySelector("input[type=checkbox]");
        display_cb.checked = path_mod.display_active;
    }
}


// update the path stats tables with the current values
function update_path_stats_tables() {

    let displayed_count = 0;

    // update the row values and display statuses
    for (let a = 0; a < path_algs.length; a++) {
        let alg = path_algs[a];
        
        let path_mod = path_mods[alg];
        let time_row_item = document.getElementById(`stats-table-row-time-${alg}`);
        let con_row_item = document.getElementById(`stats-table-row-con-${alg}`);
        
        // only display rows with data
        if (path_mod.has_data) {
            time_row_item.style.display = "";
            con_row_item.style.display = "";
            displayed_count++;
        } else {
            time_row_item.style.display = "none";
            con_row_item.style.display = "none";
            continue;
        }

        // alternate the background color of the displayed rows
        if (displayed_count % 2 === 0) {
            time_row_item.style.backgroundColor = "";
            con_row_item.style.backgroundColor = "";
        } else {
            time_row_item.style.backgroundColor = "#ddd";
            con_row_item.style.backgroundColor = "#ddd";
        }

        // get the list of cells to store values in 
        let time_cells = time_row_item.querySelectorAll(".stats-table-cell");
        let con_cells = con_row_item.querySelectorAll(".stats-table-cell");

        // update the values
        let stats = path_mod.data_ref.stats;
        time_cells[1].innerHTML = (stats.time_total / 11100).toFixed(2);
        time_cells[2].innerHTML = (stats.time_indoor / 11100).toFixed(2);
        time_cells[3].innerHTML = (stats.time_outdoor / 11100).toFixed(2);
        con_cells[1].innerHTML  = stats.congestion_average.toFixed(2);
        con_cells[2].innerHTML  = stats.congestion_min.toFixed(2);
        con_cells[3].innerHTML  = stats.congestion_max.toFixed(2);
    }
    
    // update the accordion heights if some rows disabled or not
    update_accordion_heights();
}


// detect path display checkbox changed
function path_display_checkbox_changed(alg, is_checked) {
    console.log("checked display path: ", alg, is_checked)

    let path_mod = path_mods[alg];
    let path_shape = path_mod.shape;

    if (path_shape === null) {
        return;
    }

    if (is_checked) {
        path_shape.show();
    } else {
        path_shape.hide();
    }
}


/* ---------------------------------- misc ---------------------------------- */


// open or close a given accordion section
function set_accordion_opened(accordion_button_id, is_open) {
    let accordion_button = document.getElementById(accordion_button_id);

    if (is_open) {
        accordion_button.classList.add("accordion-active");
    } else {
        accordion_button.classList.remove("accordion-active");
    }

    update_accordion_heights();
}


/* --------------------------------- navbar --------------------------------- */


// handler method for when the about button is clicked
function toggle_about_visibility() {
    
    about_page_visible = !about_page_visible;
    
    let about_overlay = document.getElementById("about-overlay");

    if (about_page_visible) {
        about_overlay.style.display = "block";
    } else {
        about_overlay.style.display = "none";
    }
}


// get the associated content element for a given navbar item
function content_id_for_about_navbar_item(element) {
    
    let id = element.id;
    let id_parts = id.split("-");
    id_parts.splice(id_parts.length - 1, 1, "content");
    id_parts.splice(1, 1);
    return id_parts.join("-");
}


// disable all about navbar and content items
function about_deactivate_all() {

    let navbar_items = document.querySelectorAll(".about-navbar-item");
    navbar_items.forEach(function (navbar_item) {

        // remove the active class from the navbar item
        navbar_item.classList.remove("about-navbar-item-active");

        // get the associated content for each navbar item
        let content_id = content_id_for_about_navbar_item(navbar_item);

        // hide the associated content
        let content_div = document.getElementById(content_id);
        content_div.style.display = "none";
    });
}

// disable all about navbar and content items
function about_deactivate_noninitially_active() {

    let navbar_items = document.querySelectorAll(".about-navbar-item");
    navbar_items.forEach(function (navbar_item) {

        // remove the active class from the navbar item
        if (navbar_item.classList.contains("about-navbar-item-active")) {
            return;
        }

        // get the associated content for each navbar item
        let content_id = content_id_for_about_navbar_item(navbar_item);

        // hide the associated content
        let content_div = document.getElementById(content_id);
        content_div.style.display = "none";
    });
}

// handle the contributors button pressed
function handle_about_navbar_button(element) {

    if (!about_page_multi_select_enabled) {
        // deactivate all items in the about page
        about_deactivate_all();
    }

    let display = "";
    
    if (element.classList.contains("about-navbar-item-active")) {
        // deactivate the current navbar item
        element.classList.remove("about-navbar-item-active");
        display = "none";
    } else {
        // activate the current navbar item
        element.classList.add("about-navbar-item-active");
        display = "block";
    }


    // show the associated content item
    let content_id = content_id_for_about_navbar_item(element);
    let content_div = document.getElementById(content_id);
    content_div.style.display = display;
}


// handle the multiselect toggle button 
function handle_about_multiselect_toggle_button() {
    about_page_multi_select_enabled = !about_page_multi_select_enabled;
}