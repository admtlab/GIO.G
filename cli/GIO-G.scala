import play.api.libs.json._

import play.api.libs.json.{JsPath, Reads, Writes}
import play.api.libs.functional.syntax.toFunctionalBuilderOps

import java.io.{BufferedWriter, File, PrintWriter}
import scala.annotation.tailrec
import scala.collection.mutable
import scala.collection.mutable.ArrayBuffer
import scala.math._
import scala.sys.exit
import scala.util.Random

private object OutputFormat extends Enumeration {
  type OutputFormat = Value
  val TXT, JSON = Value

  def getEnumWithDefault(format: String): Value =
    values.find(_.toString == format.toUpperCase).getOrElse(TXT)
}
import OutputFormat._

object GraphGenerator {
  private val usage: String =
    """
    Usage:
      sbt "run --default"              generate graph w/ default parameter configuration
      sbt "run [options]"              generate graph w/ custom parameter configuration

      e.g. CAPRIO uses => sbt "run --default --format txt --write ./src/main/resources/"

    Boolean Options:
      --noreset                             do not wipe previously generated congestion
                                            (only applies if --format TXT is set)
      --constant                            generate all buildings with a constant congestion value will tell program
                                            to ignore --high, --med, and --low configurable options

    Configurable Options:
      --num       <Int>                     configure the number of buildings (default: 25)
      --cov       <Double>                  percentage of graph covered in buildings (default: 0.75)
      --cluster   <Double>                  percentage of graph merged together to create multi-point buildings (default: 0.15)
      --high      <Double>                  percentage of graph w/ high congestion buildings (default: 0.3)
      --med       <Double>                  percentage of graph w/ medium congestion buildings (default: 0.4)
      --low       <Double>                  percentage of graph w/ low congestion buildings (default: 0.3)
      --format    <txt|json>                set format used to output file
      --write     <path>                    write output to path location

     If an option is not set, the default will be used.
     The sum of --high, --med, and --low must be 1.
  """

  // For Local CAPRIO run ->
  def main(args: Array[String]): Unit = {
    if (args.isEmpty) {
      println(usage)
      exit(1)
    }

    var resetGeneratedCongestion: Boolean = true
    @tailrec
    def nextArg(inputConfig: Config, list: List[String]): Config =
      list match {
        case Nil => inputConfig
        case "--default" :: tail =>
          nextArg(inputConfig, tail)

        case "--noreset" :: tail =>
          resetGeneratedCongestion = false
          nextArg(inputConfig, tail)
        case "--constant" :: tail =>
          inputConfig.constant_congestion = true
          nextArg(inputConfig, tail)

        case "--num" :: value :: tail =>
          inputConfig.num_buildings = value.toInt
          nextArg(inputConfig, tail)
        case "--cov" :: value :: tail =>
          inputConfig.coverage = value.toDouble
          nextArg(inputConfig, tail)
        case "--cluster" :: value :: tail =>
          inputConfig.clustering = value.toDouble
          nextArg(inputConfig, tail)
        case "--high" :: value :: tail =>
          inputConfig.high_con = value.toDouble
          nextArg(inputConfig, tail)
        case "--med" :: value :: tail =>
          inputConfig.med_con = value.toDouble
          nextArg(inputConfig, tail)
        case "--low" :: value :: tail =>
          inputConfig.low_con = value.toDouble
          nextArg(inputConfig, tail)
        case "--format" :: value :: tail =>
          inputConfig.format = getEnumWithDefault(value)
          nextArg(inputConfig, tail)
        case "--write" :: value :: tail =>
          inputConfig.writeFile = true
          inputConfig.writePath = value
          nextArg(inputConfig, tail)

        case unknown :: _ =>
          println("Unknown option " + unknown)
          println(usage)
          exit(1)
      }

    val config = nextArg(new Config(), args.toList)
    if (config.hasInvalidCongestionDistribution) {
      println(s"Invalid Congestion Distribution: ${config.high_con} + ${config.med_con} + ${config.low_con} == != 1")
      println(usage)
      exit(1)
    }

    val graph: ArrayBuffer[Building] =
      generateGraph(config.num_buildings, config.coverage, config.clustering, config.high_con, config.med_con, config.constant_congestion)

    if (config.writeFile) {
      config.format match {
        case JSON =>
          // read in write path and create any needed directories in the path
          val building_path = new File(config.writePath)
          building_path.mkdirs

          // write json output to file
          val bufferedPrintWriter = new BufferedWriter(
            new PrintWriter(building_path + s"/graph_${config.num_buildings}_${config.coverage}.json"))
          bufferedPrintWriter.write(Json.prettyPrint(generateJSONOutput(graph)))
          bufferedPrintWriter.close()
        case TXT =>
          // read in write path, add additional file structure, and create any needed directories in the path
          val building_path = new File(config.writePath + s"/sample_data/generated/")
          building_path.mkdirs

          // write building file
          val bufferedPrintWriter = new BufferedWriter(
            new PrintWriter(building_path + s"/graph_${config.num_buildings}_${config.coverage}.txt"))
          bufferedPrintWriter.write(generateTXTBuildings(graph))
          bufferedPrintWriter.close()

          // read in write path, add additional file structure, and create any needed directories in the path
          val congestion_path = new File(config.writePath + "/congestion_data/generated/")
          congestion_path.mkdirs

          // If user did not specify --noreset, delete pre-existing files
          if (resetGeneratedCongestion)
            for (f <- congestion_path.listFiles)
              f.delete

          // write congestion files
          for (b <- graph) {
            val bufferedPrintWriter = new BufferedWriter(new PrintWriter(congestion_path + s"/GenBuilding${b.id}.csv"))
            bufferedPrintWriter.write(generateTXTCongestion(b.congestion))
            bufferedPrintWriter.close()
          }

          // write configuration file for CAPRIO Experiments
          val bufferedPrintWriter2 = new BufferedWriter(
            new PrintWriter(s"src/main/resources/genGraphParameters.csv"))
          bufferedPrintWriter2.write(config.num_buildings + "," + config.coverage + "," + config.high_con + "," + config.med_con + "," + config.low_con + "," + config.constant_congestion)
          bufferedPrintWriter2.close()
      }
    } else { // If user did not specify write to file, output to console
      config.format match {
        case JSON => println(generateJSONOutput(graph))
        case TXT =>
          println(
            generateTXTBuildings(graph) + "\nIf you would like the congestion as well, please write to a file"
          )
      }
    }
  }

  // low_con is not passed because anything not high or medium congestion must be low congestion
  def generateGraph(num_buildings: Int,
                    coverage: Double,
                    clustering: Double,
                    high_con: Double,
                    med_con: Double,
                    constant_con: Boolean): ArrayBuffer[Building] = {
    val graph: ArrayBuffer[Building] = ArrayBuffer[Building]()

    val area: Double         = num_buildings / coverage
    val bounds: Double       = ceil(sqrt(area))
    val total_points: Double = bounds * bounds

    val num_high_con: Int = (num_buildings * high_con).toInt
    val num_med_con: Int  = (num_buildings * (high_con + med_con)).toInt

    val num_initial_buildings = num_buildings - round(clustering * num_buildings).toInt  // Initial buildings that could possibly be merged to
    val num_wings = round(clustering * num_buildings).toInt                              // How many wings we want to add to buildings to create "merged" buildings
    val num_standalone_buildings = (coverage * total_points).toInt - num_buildings       // How many additional buildings we need to get as close as possible to desired parameters

    // One shuffle didn't seem like it was random enough
    val building_list = Random.shuffle(Random.shuffle(mutable.ArraySeq.range(0, total_points.toInt)))
    val initial_sequence = building_list.slice(0, num_initial_buildings)
    val leftover_set: mutable.Set[Int] = mutable.Set() ++= building_list.slice(num_initial_buildings, building_list.length)

    // Step 1: Generate the bases of buildings that may be merged to in step 2
    for ((e, i) <- initial_sequence.toArray.zipWithIndex) {
      graph += generateBuilding(e, i, bounds, num_high_con, num_med_con, constant_con)
    }

    // Step 2: Add wings onto existing buildings
    var wingsAdded = 0
    while (wingsAdded < num_wings) {
      // Choose a random building to use as the base to merge into
      val indexBase = Random.nextInt(graph.length)
      val baseBuilding = graph(indexBase)
      // Check if the base has openings next to it where we can put the wing
      val candidateWing = testAdjacency(baseBuilding, leftover_set, bounds.toInt)
      val candidateWingIndex = candidateWing._1
      val candidateWingDirection = candidateWing._2
      if (candidateWingIndex != -1) {
        // Adjacent opening found
        val newWing = generateBuilding(candidateWingIndex, num_initial_buildings + wingsAdded, bounds, num_high_con, num_med_con, constant_con)
        baseBuilding.merge(newWing, candidateWingDirection)
        leftover_set -= candidateWingIndex
        wingsAdded += 1
      }

      // TODO: Remove entrances that would conflict with the new building geometry after merging the buildings
    }

    // Step 3: Add standalone buildings to maintain requested num_buildings, clustering, and coverage as best as we can
    // Convert set back to sequence and randomize it
    val standalone_seq = Random.shuffle(Random.shuffle(leftover_set.toSeq)).slice(0, num_standalone_buildings)
    for ((b, i) <- standalone_seq.zipWithIndex) {
      graph += generateBuilding(b, num_initial_buildings + num_wings + i, bounds, num_high_con, num_med_con, constant_con)
    }

    graph
  }

  private def generateBuilding(graphIndex: Int, count: Int, bounds: Double, num_high_con: Int, num_med_con: Int, constant_con: Boolean): Building = {
    // Convert from graph index into 2d grid coordinates
    val building_x: Int = (graphIndex / bounds).toInt + 1
    val building_y: Int = (graphIndex % bounds).toInt + 1

    // Assign Building Congestion type
    val building_congestion_type = {
      if (constant_con) "constant"
      else if (count < num_high_con) "high"
      else if (count < num_med_con) "med"
      else "low"
    }

    val building = new Building(graphIndex, building_x, building_y, ArrayBuffer[Entrance](), building_congestion_type, ArrayBuffer[Congestion](), new ArrayBuffer[Int], new ArrayBuffer[Int])

    // Generate Building Entrances
    val doors           = Random.between(3, 6)
    val angle_partition = 360 / doors
    for (j <- 1 to doors) {
      val door_r = Random.between(0.25, 0.45)
      val door_theta = (j * angle_partition + Random
        .between(0, angle_partition)) * (Math.PI / 180) // convert to radians from degrees

      val door_x = building_x + door_r * cos(door_theta)
      val door_y = building_y + door_r * sin(door_theta)

      val accessibility = if (Random.nextBoolean()) 1 else 0

      building.addEntrance(j, door_x, door_y, accessibility)
    }

    // Generate Building Congestion
    val building_stdDev: Double = 20.0
    val building_avg: Double =
      if (constant_con) 100.0
      else {
        if (count < num_high_con) abs(200 + (Random.nextGaussian() * building_stdDev))
        else if (count < num_med_con) abs(125.0 + (Random.nextGaussian() * building_stdDev))
        else abs(75.0 + (Random.nextGaussian() * building_stdDev))
      }

    val min = if (constant_con) 80.0 else abs(building_avg - building_stdDev * 2)
    val max = if (constant_con) 120.0 else building_avg + building_stdDev * 2

    // Write Congestion for every 5 min window of a 24hr day
    for (i <- 0 until 288) {
      val lower = i * 5
      val upper = lower + 5
      building.addCongestion(i, i.toDouble, lower, upper, min, max, building_avg, building_stdDev)
    }

    building
  }

  private def testAdjacency(b1: Building, leftover_set: mutable.Set[Int], bounds: Int): (Int, String) = {
    // Make a temporary list of all points associated with the buildings
    //   This is needed so we can check all possible adjacencies in one loop
    val allPoints_x = b1.merged_x.clone()
    allPoints_x += b1.x
    val allPoints_y = b1.merged_y.clone()
    allPoints_y += b1.y

    var index = 0
    var candidateIndex = 0
    while (index < allPoints_x.length) {
      val direction_order = Random.shuffle(Random.shuffle(mutable.ArraySeq.range(0, 4)))  // Random order so we don't always check in clockwise order
      for (direction <- direction_order) {
        direction match {
          case 0 => {
            // Check for opening above
            if (allPoints_x(index) > 0 && allPoints_x(index) < bounds && allPoints_y(index) + 1 > 0 && allPoints_y(index) + 1 < bounds) {
              // In bounds
              candidateIndex = checkForOpening(allPoints_x, allPoints_y, allPoints_x(index), allPoints_y(index) + 1, bounds, leftover_set)
              if (candidateIndex != -1) {
                return (candidateIndex, "up")
              }
            }
          }
          case 1 => {
            // Check for opening to the right
            if (allPoints_x(index) + 1 > 0 && allPoints_x(index) + 1 < bounds && allPoints_y(index) > 0 && allPoints_y(index) < bounds) {
              // In bounds
              candidateIndex = checkForOpening(allPoints_x, allPoints_y, allPoints_x(index) + 1, allPoints_y(index), bounds, leftover_set)
              if (candidateIndex != -1) {
                return (candidateIndex, "right")
              }
            }
          }
          case 2 => {
            // Check for opening below
            if (allPoints_x(index) > 0 && allPoints_x(index) < bounds && allPoints_y(index) - 1 > 0 && allPoints_y(index) - 1 < bounds) {
              // In bounds
              candidateIndex = checkForOpening(allPoints_x, allPoints_y, allPoints_x(index), allPoints_y(index) - 1, bounds, leftover_set)
              if (candidateIndex != -1) {
                return (candidateIndex, "down")
              }
            }
          }
          case 3 => {
            // Check for opening to the left
            if (allPoints_x(index) - 1 > 0 && allPoints_x(index) - 1 < bounds && allPoints_y(index) > 0 && allPoints_y(index) < bounds) {
              // In bounds
              candidateIndex = checkForOpening(allPoints_x, allPoints_y, allPoints_x(index) - 1, allPoints_y(index), bounds, leftover_set)
              if (candidateIndex != -1) {
                return (candidateIndex, "left")
              }
            }
          }
        }
      }

      index += 1
    }

    // Return -1 if the building is completely enclosed
    (-1, "N/A")
  }

  private def checkForOpening(allX: ArrayBuffer[Int], allY: ArrayBuffer[Int], test_x: Int, test_y: Int, bounds: Int, leftover_set: mutable.Set[Int]): Int = {
    // First make sure the point is not in this building already
    var index = 0
    while (index < allX.length) {
      if (allX(index) == test_x && allY(index) == test_y) {
        // The point is already a part of the building
        return -1
      }
      index += 1
    }

    // Check if the point wasn't used in the previous step
    val graphIndex = (bounds * (test_x - 1)) + (test_y - 1)   // Convert point back into index
    if (leftover_set.contains(graphIndex)) {
      // Found an empty spot
      graphIndex
    }
    else {
      // Return -1 if the spot was not open
      -1
    }
  }

  private def generateJSONOutput(graph: ArrayBuffer[Building]): JsValue = Json.toJson(graph)

  private def generateTXTBuildings(graph: ArrayBuffer[Building]): String = graph.map(b => b.toString).mkString

  private def generateTXTCongestion(congestion: ArrayBuffer[Congestion]): String =
    ",timestep,lower,upper,min,max,avg,stdDev\n" + congestion.map(c => c.toString + "\n").mkString

  private class Config {
    // Default parameters
    var num_buildings: Int = 25
    var coverage: Double   = 0.75
    var clustering: Double = 0.15

    var constant_congestion: Boolean = false
    var high_con: Double             = 0.3
    var med_con: Double              = 0.4
    var low_con: Double              = 0.3

    var writePath: String    = ""
    var writeFile: Boolean   = false
    var format: OutputFormat = TXT

    def hasInvalidCongestionDistribution: Boolean = high_con + med_con + low_con != 1.0

    override def toString: String = s"$num_buildings,$coverage,$constant_congestion,$high_con,$med_con,$low_con,$writePath,$writeFile,$format"
  }

  object Building {
    implicit val buildingReads: Reads[Building] = ((JsPath \ "id").read[Int] and
      (JsPath \ "x").read[Int] and
      (JsPath \ "y").read[Int] and
      (JsPath \ "entrances").read[ArrayBuffer[Entrance]] and
      (JsPath \ "congestion_type").read[String] and
      (JsPath \ "congestion").read[ArrayBuffer[Congestion]] and
      (JsPath \ "merged_x").read[ArrayBuffer[Int]] and
      (JsPath \ "merged_y").read[ArrayBuffer[Int]])(Building.apply _)

    implicit val buildingWrites: Writes[Building] = ((JsPath \ "id").write[Int] and
      (JsPath \ "x").write[Int] and
      (JsPath \ "y").write[Int] and
      (JsPath \ "entrances").write[ArrayBuffer[Entrance]] and
      (JsPath \ "congestion_type").write[String] and
      (JsPath \ "congestion").write[ArrayBuffer[Congestion]] and
      (JsPath \ "merged_x").write[ArrayBuffer[Int]] and
      (JsPath \ "merged_y").write[ArrayBuffer[Int]])(b => (b.id, b.x, b.y, b.entrances, b.congestion_type, b.congestion, b.merged_x, b.merged_y))
  }

  case class Building(id: Int, x: Int, y: Int, var entrances: ArrayBuffer[Entrance], congestion_type: String, congestion: ArrayBuffer[Congestion], merged_x: ArrayBuffer[Int], merged_y: ArrayBuffer[Int]) {
    val addEntrance: (Int, Double, Double, Int) => ArrayBuffer[Entrance] =
      (id: Int, x: Double, y: Double, accessibility: Int) => entrances += Entrance(id, x, y, accessibility)
    val addCongestion: (Int, Double, Int, Int, Double, Double, Double, Double) => ArrayBuffer[Congestion] =
      (id: Int, timestep: Double, lower: Int, upper: Int, min: Double, max: Double, avg: Double, stdDev: Double) =>
        congestion += Congestion(id, timestep, lower, upper, min, max, avg, stdDev)
        val merge: (Building, String) => Unit =
          (newBuilding: Building, direction: String) => {
            // Rename the entrances of the new building to continue from the old entrance numbering
            entrances = mergeHelper(entrances, newBuilding.entrances, newBuilding.x, newBuilding.y, direction)
            merged_x ++= newBuilding.merged_x
            merged_y ++= newBuilding.merged_y
            merged_x += newBuilding.x
            merged_y += newBuilding.y
            // Congestion inherited from the base building
          }

        private def mergeHelper(origEntrances: ArrayBuffer[Entrance], newEntrances: ArrayBuffer[Entrance], newX: Int, newY: Int, direction: String): ArrayBuffer[Entrance] = {
          // Find closest two points between the two buildings
          var firstLinkOrig = 0
          var firstLinkNew = 0
          var minDistance = Double.MaxValue
          for (i <- origEntrances.indices) {
            for (j <- newEntrances.indices) {
              val euclidean_distance = sqrt(pow(origEntrances(i).x - newEntrances(j).x, 2) + pow(origEntrances(i).y - newEntrances(j).y, 2))
              if (euclidean_distance < minDistance && neighborEntrance(newX, newY, origEntrances(i).x, origEntrances(i).y, direction)) {
                firstLinkOrig = i
                firstLinkNew = j
                minDistance = euclidean_distance
              }
            }
          }

          // Find next closest two points between the two buildings
          var secondLinkOrig = 0
          var secondLinkNew = 0
          minDistance = Double.MaxValue
          for (i <- origEntrances.indices) {
            for (j <- newEntrances.indices) {
              val euclidean_distance = sqrt(pow(origEntrances(i).x - newEntrances(j).x, 2) + pow(origEntrances(i).y - newEntrances(j).y, 2))
              if ((i != firstLinkOrig) && (j != firstLinkNew) && neighborEntrance(newX, newY, origEntrances(i).x, origEntrances(i).y, direction) && euclidean_distance < minDistance) {
                secondLinkOrig = i
                secondLinkNew = j
                minDistance = euclidean_distance
              }
            }
          }

          // If necessary, switch links to ensure links don't cross over each other
          direction match {
            case "up" | "down" =>
              if (origEntrances(firstLinkOrig).x > origEntrances(secondLinkOrig).x && newEntrances(firstLinkNew).x < newEntrances(secondLinkNew).x) {
                val temp = firstLinkOrig
                firstLinkOrig = secondLinkOrig
                secondLinkOrig = temp
              }
            case "left" | "right" =>
              if (origEntrances(firstLinkOrig).y > origEntrances(secondLinkOrig).y && newEntrances(firstLinkNew).y < newEntrances(secondLinkNew).y) {
                val temp = firstLinkOrig
                firstLinkOrig = secondLinkOrig
                secondLinkOrig = temp
              }
          }

          direction match {
            case "up" =>
              if (origEntrances(firstLinkOrig).x > origEntrances(secondLinkOrig).x) {
                zipEntrances(origEntrances, newEntrances, firstLinkOrig, secondLinkOrig, firstLinkNew)
              }
              else {
                zipEntrances(origEntrances, newEntrances, secondLinkOrig, firstLinkOrig, secondLinkNew)
              }
            case "down" =>
              if (newEntrances(firstLinkNew).x > newEntrances(secondLinkNew).x) {
                zipEntrances(newEntrances, origEntrances, firstLinkNew, secondLinkNew, firstLinkOrig)
              }
              else {
                zipEntrances(newEntrances, origEntrances, secondLinkNew, firstLinkNew, secondLinkOrig)
              }
            case "left" =>
              if (origEntrances(firstLinkOrig).y > origEntrances(secondLinkOrig).y) {
                zipEntrances(origEntrances, newEntrances, firstLinkOrig, secondLinkOrig, firstLinkNew)
              }
              else {
                zipEntrances(origEntrances, newEntrances, secondLinkOrig, firstLinkOrig, secondLinkNew)
              }
            case "right" =>
              if (newEntrances(firstLinkNew).y > newEntrances(secondLinkNew).y) {
                zipEntrances(newEntrances, origEntrances, firstLinkNew, secondLinkNew, firstLinkOrig)
              }
              else {
                zipEntrances(newEntrances, origEntrances, secondLinkNew, firstLinkNew, secondLinkOrig)
              }
          }
        }

        // Checks if the entrance we are checking is a direct neighbor with the new wing we are merging
        private def neighborEntrance(newX: Int, newY: Int, candidateX: Double, candidateY: Double, direction: String): Boolean = {
          // Adjust x and y to the neighbor that we are considering
          var dX = 0
          var dY = 0
          direction match {
            case "up" =>
              dX = 0
              dY = -1
            case "down" =>
              dX = 0
              dY = 1
            case "left" =>
              dX = 1
              dY = 0
            case "right" =>
              dX = -1
              dY = 0
          }

          if (candidateX > newX + dX + 0.5 || candidateX < newX + dX - 0.5 || candidateY > newY + dY + 0.5 || candidateY < newY + dY - 0.5) false else true
        }

        private def zipEntrances(firstEntrances: ArrayBuffer[Entrance],
          secondEntrances: ArrayBuffer[Entrance],
          firstLinkOne: Int,
          firstLinkTwo: Int,
          secondLinkOne: Int): ArrayBuffer[Entrance] = {

            val mergedEntrances: ArrayBuffer[Entrance] = ArrayBuffer[Entrance]()
            // Start from the first linked entrance of the first building
            mergedEntrances += firstEntrances(firstLinkOne)
            // Then go to its neighbor of the link in the second building
            mergedEntrances += secondEntrances(secondLinkOne)
            // Then go through the rest of the second building's entrances
            var currE = (secondLinkOne + 1) % secondEntrances.length
            while (currE != secondLinkOne) {
              mergedEntrances += secondEntrances(currE)
              currE = (currE + 1) % secondEntrances.length
            }
            // Finally go through all of the first building's entrances
            //    Starting from the other link and ending before the first link (already added above)
            mergedEntrances += firstEntrances(firstLinkTwo)
            currE = (firstLinkTwo + 1) % firstEntrances.length
            while (currE != firstLinkOne) {
              mergedEntrances += firstEntrances(currE)
              currE = (currE + 1) % firstEntrances.length
            }

            // Renumber the entrances according to their new order
            for ((entrance, i) <- mergedEntrances.zipWithIndex) {
              entrance.id = i + 1
            }

            mergedEntrances
        }

        override def toString: String = entrances.map(e => s"GenBuilding$id,$x,$y,$e\n").mkString
  }

  object Congestion {
    implicit val congestionReads: Reads[Congestion] = (
      (JsPath \ "id").read[Int] and
      (JsPath \ "timestep").read[Double] and
      (JsPath \ "lower").read[Int] and
      (JsPath \ "upper").read[Int] and
      (JsPath \ "min").read[Double] and
      (JsPath \ "max").read[Double] and
      (JsPath \ "avg").read[Double] and
      (JsPath \ "stdDev").read[Double]
    )(Congestion.apply _)

    implicit val congestionWrites: Writes[Congestion] = (
      (JsPath \ "id").write[Int] and
      (JsPath \ "timestep").write[Double] and
      (JsPath \ "lower").write[Int] and
      (JsPath \ "upper").write[Int] and
      (JsPath \ "min").write[Double] and
      (JsPath \ "max").write[Double] and
      (JsPath \ "avg").write[Double] and
      (JsPath \ "stdDev").write[Double]
    )(c => (c.id, c.timestep, c.lower, c.upper, c.min, c.max, c.avg, c.stdDev))
  }

  case class Congestion(id: Int,
    timestep: Double,
    lower: Int,
    upper: Int,
    min: Double,
    max: Double,
    avg: Double,
    stdDev: Double) {
      override def toString: String = s"$id,$timestep,$lower,$upper,$min,$max,$avg,$stdDev"
    }

    object Entrance {
      implicit val entranceReads: Reads[Entrance] = ((JsPath \ "id").read[Int] and
        (JsPath \ "x").read[Double] and
        (JsPath \ "y").read[Double] and
        (JsPath \ "accessible").read[Int])(Entrance.apply _)

      implicit val entranceWrites: Writes[Entrance] = ((JsPath \ "id").write[Int] and
        (JsPath \ "x").write[Double] and
        (JsPath \ "y").write[Double] and
        (JsPath \ "accessible").write[Int])(e => (e.id, e.x, e.y, e.accessible))
    }

    case class Entrance(var id: Int, x: Double, y: Double, accessible: Int) {
      override def toString: String = s" Entrance$id,$x,$y,$accessible"
    }
}


