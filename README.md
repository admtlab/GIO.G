# Generator for Indoor-Outdoor Graphs (GIO.G)

GIO.G is an open-source and configurable tool designed to streamline the modeling process and reduce manual effort, enabling researchers
and practitioners to focus more on scenario exploration and analysis. GIO.G offers a systematic and automated approach to generating Indoor-Outdoor
Graphs based on user-defined environmental parameters. This scalability extends to large environments, making GIO.G suitable for a wide range of
urban modeling applications. The details of the information can be found in our paper: <TODO: Link to paper here>.

## Prerequisites

Scala version [2.13.13](https://www.scala-lang.org/download/)  
Sbt version [1.9.8](https://www.scala-sbt.org/download/)

## Running - Web Interface

In order to run our web interface, run ```sbt run``` from the root directory. Then go to <http://localhost:9000> to see the running web application.

## Running - Command-line Interface

If you'd rather use the graph generator itself, without the web interface: 

1. First you will need to move to the *cli* folder: 
    ```bash 
    cd cli
    ```
2. Run the GIO.G through the sbt build tool
    - Output usage text detailing all the ways to use the CLI app
        ```bash 
        sbt "run"
        ```

    - Output example graph with default configuration
        ```bash
        sbt "run --default --format json" 
        ```

## License

Distributed under the MIT License. See LICENSE.txt for more information.

## Contact

[Vasilis Sarris](https://github.com/sarrisv) @ University of Pittsburgh

## Citations

- [1] V. Sarris, P. Chrysanthis, C. Costa, "Recommending the Least Congested Indoor-Outdoor Paths without Ignoring Time," in Proceedings of the 18th International Symposium on Spatial and Temporal Data, 2023, pp. 121–130.


