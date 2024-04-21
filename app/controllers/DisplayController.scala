package controllers

import play.api.mvc._
import javax.inject._
import scala.language.postfixOps

/**
 * This controller creates an `Action` to handle HTTP requests to the web interface's home page.
 */
@Singleton
class DisplayController @Inject()(cc: ControllerComponents) (implicit assetsFinder: AssetsFinder) extends AbstractController(cc) {

  def index = Action {
    Ok(views.html.index())
  }

}
