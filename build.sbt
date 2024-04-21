import scala.collection.Seq

// Note: This is to fix versioning issue between core and GIO.G - MDM '24 Demo
val jacksonVersion = "2.13.4"
val jacksonDatabindVersion = "2.13.4.2"
val jacksonOverrides = Seq(
  "com.fasterxml.jackson.core" % "jackson-core",
  "com.fasterxml.jackson.core" % "jackson-annotations",
  "com.fasterxml.jackson.datatype" % "jackson-datatype-jdk8",
  "com.fasterxml.jackson.datatype" % "jackson-datatype-jsr310"
).map(_ % jacksonVersion)
val jacksonDatabindOverrides = Seq(
  "com.fasterxml.jackson.core" % "jackson-databind" % jacksonDatabindVersion
)
val akkaSerializationJacksonOverrides = Seq(
  "com.fasterxml.jackson.dataformat" % "jackson-dataformat-cbor",
  "com.fasterxml.jackson.module" % "jackson-module-parameter-names",
  "com.fasterxml.jackson.module" %% "jackson-module-scala",
).map(_ % jacksonVersion)



lazy val root = (project in file("."))
  .enablePlugins(PlayScala)
  .settings(
    name := """GIO-G""",
    organization := "edu.pitt.cs.db",
    version := "1.0",
    crossScalaVersions := Seq("2.13.13"),
    scalaVersion := crossScalaVersions.value.head,
    libraryDependencies ++= Seq(
      guice,
      "com.h2database" % "h2" % "2.2.224",
      "org.scalatestplus.play" %% "scalatestplus-play" % "6.0.1" % Test,
      // The following are CAPRIO-Core dependencies
      "org.scala-graph" %% "graph-core" % "1.13.2",
      "com.squareup.retrofit2" % "retrofit" % "2.9.0",
      "com.squareup.retrofit2" % "converter-gson" % "2.9.0",
      "com.google.maps" % "google-maps-services" % "0.9.3",
    ),
    libraryDependencies ++= jacksonDatabindOverrides ++ jacksonOverrides ++ akkaSerializationJacksonOverrides,
    scalacOptions ++= Seq(
      "-feature",
      "-Werror"
    ),
    unmanagedBase := baseDirectory.value / "lib",
    unmanagedJars := (baseDirectory.value ** "*.jar").classpath,
    // Needed for ssl-config to create self signed certificated under Java 17
    Test / javaOptions ++= List("--add-exports=java.base/sun.security.x509=ALL-UNNAMED"),
)
