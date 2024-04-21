import scala.collection.Seq

lazy val root = (project in file("."))
  .settings(
    name := """GIO-G-CLI""",
    version := "1.0",
    crossScalaVersions := Seq("2.13.13"),
    scalaVersion := crossScalaVersions.value.head,
    libraryDependencies ++= Seq(
        "org.playframework" %% "play-json" % "3.0.2"
    )
)
