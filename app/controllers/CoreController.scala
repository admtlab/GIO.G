package controllers

import edu.pitt.cs.db.core.CAPRIOIndoorVertex

import java.io.{FileInputStream, InputStream}
import javax.inject._
import play.Environment
import play.api.libs.json.JsResult.Exception
import play.api.libs.json._
import play.api.mvc._

import scala.collection.mutable
import scala.collection.mutable.ArrayBuffer
import scala.concurrent.duration._
import scala.concurrent.{ExecutionContext, Future, Promise}
import scala.language.postfixOps
import java.sql.Timestamp
import edu.pitt.cs.db.core.Controller._
import edu.pitt.cs.db.models._

/**
 * This controller creates an `Action` to handle HTTP requests to the
 * application's home page.
 */
@Singleton
class CoreController @Inject()(cc: ControllerComponents)(implicit exec: ExecutionContext)  extends AbstractController(cc) {

  def genGraph: Action[AnyContent] = Action.async {
    (request: Request[AnyContent]) =>
        getNewGraph(request).map {msg => Ok(msg)}
  }

  private def getNewGraph(request: Request[AnyContent]): Future[JsValue] = {
    val body: JsValue = request.body.asJson.get
    // Convert to GraphConfig
    val config = Json.fromJson[GraphConfig](body).get
    // Call random_graph(config) from controller in path finding core
    val graph = random_graph(config)
    // Return the ArrayBuffer[Building] to the front end as a JSON object
    val promise: Promise[JsValue] = Promise[JsValue]()
    promise.success(Json.toJson(graph))
    promise.future
  }

  def updateGraph: Action[AnyContent] = Action.async {
    (request: Request[AnyContent]) =>
      updateBackEndGraph(request).map {msg => Ok(msg)}
  }

  private def updateBackEndGraph(request: Request[AnyContent]): Future[JsValue] = {
    val body: JsValue = request.body.asJson.get
    val new_graph = Json.fromJson[ArrayBuffer[Building]](body).get
    update_graph(new_graph)
    val promise: Promise[JsValue] = Promise[JsValue]()
    promise.success(Json.toJson("Graph Updated"))
    promise.future
  }

  def pathFind: Action[AnyContent] = Action.async {
    (request: Request[AnyContent]) =>
      findAPath(request).map {msg => Ok(msg)}
  }

  private def findAPath(request: Request[AnyContent]): Future[JsValue] = {
    val body: JsValue = request.body.asJson.get
    val path_config = Json.fromJson[PathConfig](body).get
    // Get parameters from the path configuration
    val startV = CAPRIOIndoorVertex("GenBuilding#START", Array(path_config.start_y, path_config.start_x))
    val endV = CAPRIOIndoorVertex("GenBuilding#END", Array(path_config.end_y, path_config.end_x))
    val algorithm = path_config.algorithm
    val accessibility = path_config.accessible
    val path = path_finder(startV, endV, algorithm, accessibility)
    val promise: Promise[JsValue] = Promise[JsValue]()
    promise.success(Json.toJson(path))
    promise.future
  }

}
