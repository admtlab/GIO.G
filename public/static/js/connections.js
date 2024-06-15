
/* -------------------------------------------------------------------------- */
/*                                 connections                                */
/* -------------------------------------------------------------------------- */


/* --------------------------- controller connections ----------------------- */


// contact the graph generator with the given config
async function generate_graph(config) {

    // cancel existing requests
    if (api_gen_graph_active) {
        if (api_gen_graph_abort_controller !== null) {
            api_gen_graph_abort_controller.abort();
        }
        console.log("stopping active graph generation request");
        return;
    } else if (api_path_rec_active) {
        if (api_path_rec_abort_controller !== null) {
            api_path_rec_abort_controller.abort();
        }
        console.log("stopping active path recommendation request");
    }

    console.log("generating graph with config: ", config);

    // set active status
    api_gen_graph_active = true;
    set_graph_gen_spinner_enabled(true);
    let submit_button = document.getElementById("graph-gen-submit-button");
    update_toggle_button_active(submit_button, false);

    // set new abort controller and timeout
    api_gen_graph_abort_controller = new AbortController();
    const timeout_id = setTimeout(() => api_gen_graph_abort_controller.abort(), api_request_timeout);

    // send request to generate a new graph
    fetch("http://localhost:9000/new_graph", {
        method: 'POST',
        headers: {
          'Csrf-Token': 'nocheck',
          'Accept': 'application/json, text/plain, */*',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(config),
        signal: api_gen_graph_abort_controller.signal
    })
    
    // get json response data
    .then((res) => {
        clearTimeout(timeout_id);
        return res.json();
    })

    // process the graph and draw it
    .then((json) => {
        
        console.log("graph data: ", json);
        process_generated_graph(json, config);

        // reset active state
        api_gen_graph_active = false;
        set_graph_gen_spinner_enabled(false);
        update_toggle_button_active(submit_button, true);
    })
    .catch((err) => {
        console.error(err);

        // reset active state
        api_gen_graph_active = false;
        set_graph_gen_spinner_enabled(false);
        update_toggle_button_active(submit_button, true);

        let error_text = err.name === "AbortError" ? "ERROR: request cancelled" : "ERROR: interal error";
        document.getElementById("graph-gen-error-text").innerHTML = error_text;

        update_accordion_heights();
    });
}

// contact the path recommender with the given options
async function recommend_paths(path_configs) {

    // cancel existing requests
    if (api_path_rec_active) {
        if (api_path_rec_abort_controller !== null) {
            api_path_rec_abort_controller.abort();
        }
        console.log("stopping active path recommendation request");
        return;
    } else if (api_gen_graph_active) {
        if (api_gen_graph_abort_controller !== null) {
            api_gen_graph_abort_controller.abort();
        }
        console.log("stopping active graph generation request");
    }

    // get a filtered version of the graph
    let filtered_graph = filter_current_graph(false, false);
    
    console.log("recommending paths with options: ", path_configs);
    console.log("filtered graph: ", filtered_graph);
    
    // set active status
    api_path_rec_active = true;
    set_path_gen_spinner_enabled(true);

    // set new abort controller and timeout
    api_path_rec_abort_controller = new AbortController();
    const timeout_id = setTimeout(() => api_path_rec_abort_controller.abort(), api_request_timeout);

    let submit_button = document.getElementById("path-gen-submit-button");
    update_toggle_button_active(submit_button, false);
    
    let test_enabled = false;
    if (test_enabled) {

        // TEMPORARY SO CONNOR CAN TEST BACKEND COMMUNICATION
        // backend connection to generate a new graph
        const response = await fetch("http://localhost:9000/update_graph", {
            method: "POST",
            headers: {
                'Csrf-Token': 'nocheck',
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(filtered_graph)
        });
        console.log("response from back end", response.json());
    
        console.log("finding path for config: ", path_configs[0]);
        // backend connection to generate a new graph
        const response2 = await fetch("http://localhost:9000/find_path", {
            method: "POST",
            headers: {
                'Csrf-Token': 'nocheck',
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(path_configs[0])
        });
        console.log("path", response2.json());

        return;
    }

    // send the current graph to the backend graph update endpoint
    fetch("http://localhost:9000/update_graph", {
        method: 'POST',
        headers: {
            'Csrf-Token': 'nocheck',
            'Accept': 'application/json, text/plain, */*',
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(filtered_graph),
        signal: api_path_rec_abort_controller.signal
    })

    // check response for graph update
    .then((res) => {

        // check if request failed
        if (res.status !== 200) {
            throw new Error("ERROR: graph update request not successful");
        }

        // make requests for each algorithm
        return Promise.all(path_configs.map((path_config) => 
            fetch("http://localhost:9000/find_path", {
                method: 'POST',
                headers: {
                    'Csrf-Token': 'nocheck',
                    'Accept': 'application/json, text/plain, */*',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(path_config),
                signal: api_path_rec_abort_controller.signal
            })
        ));

    // get json objects from responses
    }).then(responses =>
        Promise.all(responses.map(response => response.json()))

    // process and draw the paths
    ).then((jsons) => {

        clearTimeout(timeout_id);

        // associate each returned stats and path with the algorithm name
        let alg_results = {};
        for (let i = 0; i < path_configs.length; i++) {
            // alg_results[path_configs[i].algorithm] = jsons[i];
            alg_results[path_configs[i].algorithm] = {
                stats: jsons[i][0],
                path: jsons[i][1]
            };
        }
        process_paths(alg_results);

        // reset active state
        api_path_rec_active = false;
        set_path_gen_spinner_enabled(false);
        update_toggle_button_active(submit_button, true);
        
    }).catch(err => {
        console.log(err);

        // reset active state
        api_path_rec_active = false;
        set_path_gen_spinner_enabled(false);
        update_toggle_button_active(submit_button, true);

        let error_text = err.name === "AbortError" ? "ERROR: request cancelled" : "ERROR: interal error";
        document.getElementById("path-gen-error-text").innerHTML = error_text;

        update_accordion_heights();
    });
}


/* ---------------------------- local connections --------------------------- */


// load a local preset graph file
function load_preset_graph(graph_file) {

    // get the graph and draw its buildings on the response
    fetch(`/assets/static/assets/graphs/${graph_file}`)
        .then((res) => res.json())
        .then((json) => {
            console.log("preset graph data: ", json);
            process_preset_graph(json);
        })
        .catch((e) => console.error(e));
}
