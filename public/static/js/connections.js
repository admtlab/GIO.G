
/* -------------------------------------------------------------------------- */
/*                                 connections                                */
/* -------------------------------------------------------------------------- */


/* --------------------------- controller connections ----------------------- */


// contact the graph generator with the given config
async function generate_graph(config) {

    console.log("generating graph with config: ", config);

    // send request to generate a new graph
    fetch("http://localhost:9000/new_graph", {
        method: 'POST',
        headers: {
          'Accept': 'application/json, text/plain, */*',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(config)})
    
    // get json response data
    .then((res) => res.json())

    // process the graph and draw it
    .then((json) => {
        console.log("graph data: ", json);
        process_generated_graph(json, config);
    })
    .catch((e) => console.error(e));
}

// contact the path recommender with the given options
async function recommend_paths(path_configs) {

    // get a filtered version of the graph
    let filtered_graph = filter_current_graph(false, false);

    console.log("recommending paths with options: ", path_configs);
    console.log("filtered graph: ", filtered_graph);

    let test_enabled = false;
    if (test_enabled) {

        // TEMPORARY SO CONNOR CAN TEST BACKEND COMMUNICATION
        // backend connection to generate a new graph
        const response = await fetch("http://localhost:9000/update_graph", {
            method: "POST",
            headers: {
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
            'Accept': 'application/json, text/plain, */*',
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(filtered_graph)})

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
                    'Accept': 'application/json, text/plain, */*',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(path_config)})
        ));

    // get json objects from responses
    }).then(responses =>
        Promise.all(responses.map(response => response.json()))

    // process and draw the paths
    ).then((jsons) => {
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
    }).catch(err => console.log(err));

    // TODO: remove this (and test path files) since it's no longer needed
    //// use local path data for now
    //Promise.all(path_configs.map((path_config) => 
    //    fetch(`/static/assets/paths/${path_config.algorithm}.json`)
    //)).then(responses =>
    //    Promise.all(responses.map(response => response.json()))
    
    //// process and draw the paths
    //).then((jsons) => {
    //    // associate each returned stats and path with the algorithm name
    //    let alg_results = {};
    //    for (let i = 0; i < path_configs.length; i++) {
    //        alg_results[path_configs[i].algorithm] = jsons[i];
    //    }
    //    console.log("paths data: ", alg_results);
    //    process_paths(alg_results);
    //}).catch(err => console.log(err));
}


/* ---------------------------- local connections --------------------------- */


// load a local preset graph file
function load_preset_graph(graph_file) {

    // get the graph and draw its buildings on the response
    fetch(`/static/assets/graphs/${graph_file}`)
        .then((res) => res.json())
        .then((json) => {
            console.log("preset graph data: ", json);
            process_preset_graph(json);
        })
        .catch((e) => console.error(e));
}
