allprojects {
    repositories {
        google()
        mavenCentral()
    }
}

val newBuildDir: Directory =
    rootProject.layout.buildDirectory
        .dir("../../build")
        .get()
rootProject.layout.buildDirectory.value(newBuildDir)

subprojects {
    val newSubprojectBuildDir: Directory = newBuildDir.dir(project.name)
    project.layout.buildDirectory.value(newSubprojectBuildDir)
}
// Plugins such as `jni` pin `ndkVersion flutter.ndkVersion` (28.2), which
// isn't installed here and keeps failing to download. Build every plugin with
// the same NDK the app already uses instead.
subprojects {
    if (project.name != "app") {
        afterEvaluate {
            extensions.findByType(com.android.build.gradle.BaseExtension::class.java)
                ?.ndkVersion = "27.0.11902837"
        }
    }
}
subprojects {
    project.evaluationDependsOn(":app")
}

tasks.register<Delete>("clean") {
    delete(rootProject.layout.buildDirectory)
}
