
/* -------------------------------------------------------------------------- */
/*                               stage controls                               */
/* -------------------------------------------------------------------------- */


/* ------------------------------ setup stages ------------------------------ */


// create and add layers to the main stage
function create_main_layers() {

    // create and add new layers
    building_layer = new Konva.Layer({
        listening: false
    });
    road_layer = new Konva.Layer({
        // listening: false // TODO: add listening false back when you remove road hiding support
    });
    path_layer = new Konva.Layer({
        listening: false
    });
    selection_layer = new Konva.Layer({
        listening: false
    });
    
    main_stage.add(road_layer);
    main_stage.add(building_layer);
    main_stage.add(path_layer);
    main_stage.add(selection_layer);
}


// setup stage event handlers
function setup_main_stage_callbacks() {
    
    // process clicks for the selection layer
    // (different from panning mouseup which is already bound, if want to bind to that event you need to use namespaces like mouseup.pan and mouseup.select)
    main_stage.off(".selection");
    main_stage.on("click.selection", function (e) {
        if (!main_is_panning && e.evt.button === 0) {
            select_point();
        }
    });
}


/* ----------------------------- stage resizing ----------------------------- */


// create stage objects using their containers' height
function create_stages() {

    let main_stage_initial_size = 850;

    // get the containers of the stages and their parents
    let main_stage_container = document.getElementById("graph-stage");
    let editor_stage_container = document.getElementById("building-editor-stage");

    // get necessary dimensions of the container cells
    let main_container_width = main_stage_container.offsetWidth;
    let main_container_height = main_stage_container.offsetHeight;
    let editor_container_width = editor_stage_container.offsetWidth; // don't need height since it's a square

    // determine the scale for the stage
    let main_scale = Math.min(1, main_container_height / main_container_width);
    if (main_stage_initial_size < main_container_width) {
        main_scale *= main_stage_initial_size / main_container_width;
    }

    // determine offset to place graph in the middle of the stage
    let main_x_offset = (main_container_width - main_container_width * main_scale) / 2;
    let main_y_offset = (main_container_height - main_container_width * main_scale) / 2;

    console.log("create stages, main width: ", main_container_width, "height: ", main_container_height);
    console.log("editor width: ", editor_container_width);

    // create the stages
    main_stage = new Konva.Stage({
        container: "graph-stage",
        width: Math.floor(main_container_width) - 1, // slightly underestimate size to prevent display bugs
        height: Math.floor(main_container_height) - 1,
        scale: {x:main_scale, y:main_scale},
        x: main_x_offset,
        y: main_y_offset
    });

    editor_stage = new Konva.Stage({
        container: "building-editor-stage",
        width: Math.floor(editor_container_width) - 1,
        height: Math.floor(editor_container_width) - 1
    });

    // setup callbacks for the main stage
    main_stage.on("mousedown.pan", panning_main_stage_mousedown);
    main_stage.on("mousemove.pan", panning_main_stage_mousemove);
    main_stage.on("mouseleave.pan", panning_main_stage_mouseleave);
    main_stage.on("mouseup.pan", panning_main_stage_mouseup);
    main_stage.on("wheel.zoom", zooming_main_stage_wheel);

    // setup callbacks for editor stage
    editor_stage.on("mousedown.pan", panning_editor_stage_mousedown);
    editor_stage.on("mousemove.pan", panning_editor_stage_mousemove);
    editor_stage.on("mouseleave.pan", panning_editor_stage_mouseleave);
    editor_stage.on("mouseup.pan", panning_editor_stage_mouseup);
    editor_stage.on("wheel.zoom", zooming_editor_stage_wheel);
}


// update stage objects using their containers' height
function size_stages_to_containers() {

    if (main_stage === null || editor_stage === null) {
        return;
    }

    // get the stage containers and their parent containers
    let main_stage_container = document.getElementById("graph-stage");
    let editor_stage_container = document.getElementById("building-editor-stage");
    let main_stage_container_container = main_stage_container.parentNode;
    let editor_stage_container_container = editor_stage_container.parentNode;

    // temporarily set the display to none to get accurate readings of sizes
    main_stage_container.style.display = "none";
    editor_stage_container.style.display = "none";

    // get the sizes of the containers
    let main_container_width = main_stage_container_container.offsetWidth;
    let main_container_height = main_stage_container_container.offsetHeight;
    let editor_container_width = editor_stage_container_container.offsetWidth;

    // reset display status
    main_stage_container.style.display = "";
    editor_stage_container.style.display = "";

    
    // set the widths and heights of the stages (slightly under container size to not cause weird overflow issues)
    main_stage.width(Math.floor(main_container_width) - 1);
    main_stage.height(Math.floor(main_container_height) - 1);
    editor_stage.width(Math.floor(editor_container_width) - 1);
    editor_stage.height(Math.floor(editor_container_width) - 1);
}


/* -------------------------- main stage panning support ------------------------- */


// get the current position of the cursor within the stage in scaled and translated coordinates
// function stage_pointer_coords() {
//     let scale = main_stage.scaleX();
//     let pointer = main_stage.getPointerPosition();

//     return {
//         x: (pointer.x - main_stage.x()) / scale,
//         y: (pointer.y - main_stage.y()) / scale,
//     };
// }


// callback for detection of any mouse down events on the stage
function panning_main_stage_mousedown(e) {
    // console.log("stage mouse down!");

    if (e.evt.button !== 0 || !can_pan_enabled) {
        return;
    }

    main_is_pan_attempted = true;

    // set panning start positions
    main_pan_start_pointer_pos = main_stage.getPointerPosition();
    main_pan_start_stage_pos = {
        x: main_stage.x(),
        y: main_stage.y()
    };
    // e.evt.preventDefault();
};


// callback for detection of mouse movement events on the stage
function panning_main_stage_mousemove(e) {

    // do nothing if not currently panning
    if (!main_is_pan_attempted || (!main_is_pan_attempted && !main_is_panning) || main_pan_start_pointer_pos === null || main_pan_start_stage_pos === null || !can_pan_enabled) {
        return;
    }

    // get the current position of the pointer
    let pan_end_pointer_pos = main_stage.getPointerPosition();

    // find the difference in pointer positions
    let pan_diff = {
        x: pan_end_pointer_pos.x - main_pan_start_pointer_pos.x,
        y: pan_end_pointer_pos.y - main_pan_start_pointer_pos.y 
    };

    // check if a pan has been attempted but not started
    if (main_is_pan_attempted && !main_is_panning) {
        
        let dist = Math.hypot(pan_diff.x, pan_diff.y);

        if (dist > main_pan_min_dist) {
            main_is_panning = true;

            // reset start pointer position to cleanly begin panning
            main_pan_start_pointer_pos = pan_end_pointer_pos;
            pan_diff = {
                x: pan_end_pointer_pos.x - main_pan_start_pointer_pos.x,
                y: pan_end_pointer_pos.y - main_pan_start_pointer_pos.y 
            };
        } else {
            return;
        }
    }

    // set the move cursor pointer
    main_stage.container().style.cursor = "move";

    let scale = main_stage.scaleX();

    // convert the end pointer position to local coordinates
    let pan_end_local = {
        x: (pan_end_pointer_pos.x - main_pan_start_stage_pos.x) / scale,
        y: (pan_end_pointer_pos.y - main_pan_start_stage_pos.y) / scale
    };

    // calculate the new stage position
    let new_stage_pos = {
        x: pan_end_pointer_pos.x - pan_end_local.x * scale + pan_diff.x,
        y: pan_end_pointer_pos.y - pan_end_local.y * scale + pan_diff.y
    };

    main_stage.position(new_stage_pos);
};


// callback for detection of when the cursor moves out of the stage
function panning_main_stage_mouseleave(e) {

    // disable panning if it is enabled
    if (main_is_panning || main_is_pan_attempted || !can_pan_enabled) {
        main_pan_start_pointer_pos = null;
        main_pan_start_stage_pos = null;
        main_is_panning = false;
        main_is_pan_attempted = false;
    }

    main_stage.container().style.cursor = "default";
};


// callback for detection of when the cursor is released in the stage
function panning_main_stage_mouseup(e) {
    console.log("stage mouse up");

    // disable panning if it is enabled
    if (main_is_panning || main_is_pan_attempted || !can_pan_enabled) {
        main_pan_start_pointer_pos = null;
        main_pan_start_stage_pos = null;
        main_is_panning = false;
        main_is_pan_attempted = false;
    }

    main_stage.container().style.cursor = "default";
};


/* -------------------------- main stage zooming support ------------------------- */


// callback for when wheel movement detected on main stage
function zooming_main_stage_wheel(e) {
    // stop default scrolling
    e.evt.preventDefault();

    if (main_is_panning || !can_zoom_enabled) {
        return;
    }

    let old_scale = main_stage.scaleX();
    let pointer = main_stage.getPointerPosition();

    let stage_coords = {
        x: (pointer.x - main_stage.x()) / old_scale,
        y: (pointer.y - main_stage.y()) / old_scale,
    };

    // how to scale? Zoom in? Or zoom out?
    let direction = e.evt.deltaY > 0 ? -1 : 1;

    // when we zoom on trackpad, e.evt.ctrlKey is true
    // in that case lets revert direction
    if (e.evt.ctrlKey) {
        direction = -direction;
    }

    let new_scale = direction > 0 ? old_scale * main_stage_scale_by : old_scale / main_stage_scale_by;

    main_stage.scale({ x: new_scale, y: new_scale });

    let new_pos = {
        x: pointer.x - stage_coords.x * new_scale,
        y: pointer.y - stage_coords.y * new_scale,
    };
    main_stage.position(new_pos);
};


/* -------------------------- editor stage panning support ------------------------- */


// callback for detection of any mouse down events on the stage
function panning_editor_stage_mousedown(e) {

    if (e.evt.button !== 0 || editor_is_dragging_door || !can_pan_enabled) {
        return;
    }

    editor_is_pan_attempted = true;

    // set panning start positions
    editor_pan_start_pointer_pos = editor_stage.getPointerPosition();
    editor_pan_start_stage_pos = {
        x: editor_stage.x(),
        y: editor_stage.y()
    };
    // e.evt.preventDefault();
};


// callback for detection of mouse movement events on the stage
function panning_editor_stage_mousemove(e) {

    // do nothing if not currently panning
    if (!editor_is_pan_attempted || (!editor_is_pan_attempted && !editor_is_panning) || editor_pan_start_pointer_pos === null || editor_pan_start_stage_pos === null || !can_pan_enabled || editor_is_dragging_door) {
        return;
    }

    // get the current position of the pointer
    let pan_end_pointer_pos = editor_stage.getPointerPosition();

    // find the difference in pointer positions
    let pan_diff = {
        x: pan_end_pointer_pos.x - editor_pan_start_pointer_pos.x,
        y: pan_end_pointer_pos.y - editor_pan_start_pointer_pos.y 
    };

    // check if a pan has been attempted but not started
    if (editor_is_pan_attempted && !editor_is_panning) {
        
        let dist = Math.hypot(pan_diff.x, pan_diff.y);

        if (dist > editor_pan_min_dist) {
            editor_is_panning = true;

            // reset start pointer position to cleanly begin panning
            editor_pan_start_pointer_pos = pan_end_pointer_pos;
            pan_diff = {
                x: pan_end_pointer_pos.x - editor_pan_start_pointer_pos.x,
                y: pan_end_pointer_pos.y - editor_pan_start_pointer_pos.y 
            };
        } else {
            return;
        }
    }

    // set the move cursor pointer
    editor_stage.container().style.cursor = "move";

    let scale = editor_stage.scaleX();

    // convert the end pointer position to local coordinates
    let pan_end_local = {
        x: (pan_end_pointer_pos.x - editor_pan_start_stage_pos.x) / scale,
        y: (pan_end_pointer_pos.y - editor_pan_start_stage_pos.y) / scale
    };

    // calculate the new stage position
    let new_stage_pos = {
        x: pan_end_pointer_pos.x - pan_end_local.x * scale + pan_diff.x,
        y: pan_end_pointer_pos.y - pan_end_local.y * scale + pan_diff.y
    };

    editor_stage.position(new_stage_pos);
};


// callback for detection of when the cursor moves out of the stage
function panning_editor_stage_mouseleave(e) {

    // disable panning if it is enabled
    if (editor_is_panning || editor_is_pan_attempted || !can_pan_enabled) {
        editor_pan_start_pointer_pos = null;
        editor_pan_start_stage_pos = null;
        editor_is_panning = false;
        editor_is_pan_attempted = false;
    }

    editor_stage.container().style.cursor = "default";
};


// callback for detection of when the cursor is released in the stage
function panning_editor_stage_mouseup(e) {
    console.log("stage mouse up");

    // disable panning if it is enabled
    if (editor_is_panning || editor_is_pan_attempted || !can_pan_enabled) {
        editor_is_panning = false;
        editor_is_pan_attempted = false;
        editor_pan_start_pointer_pos = null;
        editor_pan_start_stage_pos = null;
    }

    editor_stage.container().style.cursor = "default";
};


/* -------------------------- editor stage zooming support ------------------------- */


// callback for when wheel movement detected on main stage
function zooming_editor_stage_wheel(e) {
    // stop default scrolling
    e.evt.preventDefault();

    if (editor_is_panning || !can_zoom_enabled) {
        return;
    }

    let old_scale = editor_stage.scaleX();
    let pointer = editor_stage.getPointerPosition();

    let stage_coords = {
        x: (pointer.x - editor_stage.x()) / old_scale,
        y: (pointer.y - editor_stage.y()) / old_scale,
    };

    // how to scale? Zoom in? Or zoom out?
    let direction = e.evt.deltaY > 0 ? -1 : 1;

    // when we zoom on trackpad, e.evt.ctrlKey is true
    // in that case lets revert direction
    if (e.evt.ctrlKey) {
        direction = -direction;
    }

    let new_scale = direction > 0 ? old_scale * editor_stage_scale_by : old_scale / editor_stage_scale_by;

    editor_stage.scale({ x: new_scale, y: new_scale });

    let new_pos = {
        x: pointer.x - stage_coords.x * new_scale,
        y: pointer.y - stage_coords.y * new_scale,
    };
    editor_stage.position(new_pos);
};
