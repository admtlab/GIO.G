
/* -------------------------------------------------------------------------- */
/*                      variable and constant definitions                     */
/* -------------------------------------------------------------------------- */


// default configuation values defined in GraphGenerator.scala
const default_config = {
    num_buildings: 25,
    coverage: 0.75,
    clustering: 0.15,
    constant_con: false,
    high_con: 0.3,
    med_con: 0.4,
    low_con: 0.3 
};

// store the next configuration's congestion values whenever they are updated
let next_config_con_values = {
    low: 0.3,
    med: 0.4,
    high: 0.3
};

// store list of supported path finding algorithms
const path_algs = ["astro", "dijkstraC", "astroG", "dijkstra", "greedy"];

// store list of directions
const ordered_directions = ["up", "right", "down", "left"];

// store data about the current graph
let current_config = default_config;
let current_graph = null;
let current_paths = null;
let path_mods = null;
let grid = null;

// building selection variables
let editor_selected_cell_info = null;
let editor_selected_grid_coords = null;
let path_start_selected_grid_coords = null;
let path_end_selected_grid_coords = null;
let path_start_selection_shape = null;
let path_end_selection_shape = null;
let is_selecting_path_start = false;
let is_selecting_path_end = false;
let is_selecting_new_connection = false;
let new_connection_start_cell_info = null;

// stage display variables
let main_cell_dims = null;
let main_door_dims = null;
let editor_cell_dims = null;
let editor_door_dims = null;
let door_len_ratio = 0.075;
let cell_spacing_ratio = 0;
let editor_inset_ratio = 0.05;
let building_stroke_size_ratio = 0.0075;
let door_stroke_size_ratio = 0.005;
let endpoint_selection_size_ratio = 0.075;
let should_invert_door_y = false;
let road_size_ratio = 0.1;
let road_dashes_per_cell = 10;
let removed_roads_enabled = true;
let removed_roads_thru_buildings_enabled = false;
let building_clipping_enabled = true;
let building_corridors_enabled = true;
let building_con_colors_enabled = true;
let highlight_colors_enabled = true;
let path_endpoints_enabled = true;
let can_pan_enabled = true;
let can_zoom_enabled = true;
let auto_open_sections_enabled = true;
let auto_reset_path_endpoints_enabled = true;

let road_rand_weight_min = 0.35;
let road_rand_weight_max = 1.25;
let horz_roads_rand_weights = [];
let vert_roads_rand_weights = [];

// color definitions
const building_con_colors = {
    low: "#CAFFBF", // pale green
    med: "#FFD6A5", // pale orange
    high: "#FFADAD", // pale red
    constant: "#A9DEF9" // pale blue
}
const corridor_con_colors = { // associated background congestion color with 0.5 opacity black overlay
    low: "#B4D9AC",
    med: "#D9BC9A",
    high: "#D9A0A0",
    constant: "#9ECBDF"
}
const con_text_color_classes = {
    low: "low-con-text-color",
    med: "med-con-text-color",
    high: "high-con-text-color"
};
const selection_colors = {
    editing: "rgba(0,0,255,0.65)",
    path_start: "rgba(0,255,0,0.65)",
    path_end: "rgba(255,0,0,0.65)"
};

// options to define path styles
const path_type_options = {
    solid: {
        dash: null,
        exterior_offset: 1,
        // color: "red", // Konva.Util.getRandomColor()
        color: "#023047"
    }, 
    dashed: {
        dash: [0.1, 0.1],
        exterior_offset: 2,
        // color: "cyan", //Konva.Util.getRandomColor()
        color: "#2a9d8f"
    },
    dotted: {
        dash: [0.00001, 0.05],
        exterior_offset: 3,
        // color: "fuchsia", // Konva.Util.getRandomColor()
        color: "#A907F3",
    },
    dotdashed: {
        dash: [0.00001, 0.05, 0.1, 0.05],
        exterior_offset: 4,
        // color: "green", // Konva.Util.getRandomColor()
        color: "#E06900"
    },
    longdashed: {
        dash: [0.2, 0.05],
        exterior_offset: 5,
        // color: "purple", //Konva.Util.getRandomColor()
        color: "#DB508C"
    }
};
const alg_path_types = {
    astro: "solid",
    dijkstraC: "dotdashed",
    astroG: "dashed", 
    dijkstra: "dotted",
    greedy: "longdashed"
};
let path_line_cap = "round"; // round, square, or butt
let path_line_join = "round"; // round, mite, or bevel
let show_path_type_color = true;

// variables to support panning on stages
let main_pan_start_pointer_pos = null;
let main_pan_start_stage_pos = null;
let main_is_panning = false;
let main_is_pan_attempted = false;
let main_stage_scale_by = 1.05;
const main_pan_min_dist = 5;

let editor_pan_start_pointer_pos = null;
let editor_pan_start_stage_pos = null;
let editor_is_panning = false;
let editor_is_pan_attempted = false;
let editor_stage_scale_by = 1.05;
const editor_pan_min_dist = 10;
let editor_is_dragging_door = false;

// define congestion constants
const con_std_dev = 20;
const con_level_names = {
    low: "Low",
    med: "Medium",
    high: "High"
};
const con_vals = {
    low: 75,
    med: 125,
    high: 200,
    constant: 100
};

// define stages
let main_stage = null;
let editor_stage = null;

// define layer variables for the main stage (created when main stage is drawn)
let selection_layer = null;
let building_layer = null;
let road_layer = null;
let path_layer = null;

// about page variables
let year_text = new Date().getFullYear();
let about_page_visible = false;
let about_page_multi_select_enabled = false;

/* -------------------------------------------------------------------------- */
/*                            main event listeners                            */
/* -------------------------------------------------------------------------- */


// execute when the document is ready
document.addEventListener("DOMContentLoaded", function() { 

    // create the stages to fit to parent containers
    create_stages();
    
    // create the necessary layers to draw
    create_main_layers();

    // setup necessary callbacks
    setup_main_stage_callbacks();

    // initialize graph gen config form
    setup_graph_gen_form();
    
    // initialize path mods data structure to default values
    init_path_mods();
    
    // update any path display sections in the sidebars
    update_path_display_sections();
    
    // clear necessary content in the building editor
    reset_building_editor(true);
    
    // set up the accordion button event listeners and transitions
    setup_accordion_buttons();

    // hide non initially active about items
    about_deactivate_noninitially_active();

    // set toggle buttons active class
    update_toggle_buttons_active();

    // generate a graph with the default config
    // generate_graph(default_config);

    // load a preset graph
    let preset = "graph_25_0.75.json"
    update_preset_select_display(preset)
    load_preset_graph(preset);

    // update the current year for the copyright date
    document.getElementById("navbar-copyright-year").innerHTML = year_text;
    document.getElementById("about-copyright-year").innerHTML = year_text;
});


// execute when the window is resized
window.addEventListener("resize", function(event) {

    // update stage dimensions to fit parent container
    size_stages_to_containers();

    // update sidebar accordion cell heights
    update_accordion_heights();

    // recalculate editor drawing dimensions
    calculate_editor_draw_dims(editor_selected_cell_info);

    // redraw the building in the editor
    redraw_selected_building(editor_selected_cell_info);

}, true);


// add escape key press detection for different actions
document.addEventListener("keyup", function(e) { 

    // closes the about page or disables current selection statuses
    if (e.key === "Escape") {
       
        if (about_page_visible) {
            toggle_about_visibility();
        } else {
            reset_currently_selecting_status();
        }
    
    // enable selection for a new path start point
    } else if (e.key.toLowerCase() === "s") {
        handle_select_start_building_button();

    // enable selection for a new path end point
    } else if (e.key.toLowerCase() === "e") {
        handle_select_end_building_button();

    // enable selection for a new building to connect to
    } else if (e.key.toLowerCase() === "c") {
        if (editor_selected_cell_info !== null) {
            handle_select_connect_building_button(editor_selected_cell_info);
        }

    // delete the current building
    } else if (e.key.toLowerCase() === "d") {
        if (editor_selected_cell_info !== null && editor_selected_cell_info.building_data !== null) {
            handle_delete_building_button(editor_selected_cell_info);
        }

    // add a new building at the given coords
    } else if (e.key.toLowerCase() === "a") {
        if (editor_selected_grid_coords !== null && editor_selected_cell_info !== null) {

            // delete the current building first if it exists
            if (editor_selected_cell_info.building_data !== null) {
                handle_delete_building_button(editor_selected_cell_info);
            }
            
            handle_add_building_button(editor_selected_grid_coords);
        }

    // generate a new graph
    } else if (e.key.toLowerCase() === "g") {
        submit_graph_gen_form();

    // recommend new paths
    } else if (e.key.toLowerCase() === "r") {
        submit_path_gen_form();
    }   
});