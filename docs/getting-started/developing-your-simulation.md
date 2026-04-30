# Developing your Simulation

## Installing Truman

After you have completed translating your research question into an experimental design, you can begin developing your simulation based on your design.

Begin by [installing Truman](/docs/setting-up-truman/installing-truman/index.md) on your local computer.

## Understanding the timeline

The Truman Platform looks and feels like a real social networking site, because it is a social networking site. Researchers can curate, create, and control every actor, post, like, comment, notification, and interaction on the social networking site.

Every one of these interactions and behaviors is defined around _the moment the participant joins the site_, so each participant has their own individual timeline within the study.

For example, when simulating posts to be on the website, you define when a research participant will perceive the post to have been posted. Anything given a negative time (ex: -12:30) is viewed as something posted in the past or before the participant joined the site (ex: 12 hours and 30 minutes before), while anything with a positive time (5:30) is viewed as something posted in the future or after the participant joined the site (5 hours and 30 minutes after). These posts are staggered throughout the duration of the study (with some negative times) to emulate a real experience.

As a result, the Truman platform manages parallel simulations for all study participants. Study participants don’t connect or interact with any other real participant on the site, even though they believe they do, and all participants are exposed to the same social interactions, posts, and responses (except for variations controlled by the experimental condition of the study and the participant's own posting behavior) within a controlled environment that looks and feels realistic.

## Creating a Simulation: How to translate your design into simulations

A Truman simulation is the simulated social media environment that a research participant experiences.
Here is what you need to build your own simulation:

- **Actors**: Actors are the simulated users on the platform that research participants believe are real people. You’ll create personas for all actors in the simulation. This includes information such as usernames, names, bios, and profile photos.
- **Posts**: Posts are the simulated posts on the platform feed/timeline. All posts include images and text. When defining the simulated posts, you will need to consider the timing of the posts (as described [above](#understanding-the-timeline)
  ) and the comments left by other actors on the posts.
- **Notifications:** Notifications are the behavioral feedback of the actors in response to a research participant's behavior on the platform. For example, when a participant makes a post on the feed, you can define notifications that are sent to the participant that indicate other actors on the site viewed or liked the post. This reinforces the realism of the platform and signals to the participant that there are other "people" on the website too.

[Defining your Simulation](/docs/setting-up-truman/defining-your-simulation/index.md) for more details on creating the simulation.

### Displaying different simulation content for different experimental conditions

Researchers can readily display different simulation _content_ (specifically, different actors, posts, comments, notifications) for different experimental conditions by labeling them in the Truman Platform infrastructure.

See [Defining your Simulation](/docs/setting-up-truman/defining-your-simulation/index.md) for more details on how to display different simulations for different experimental conditions.

### Displaying different simulation interfaces for different experimental conditions

Researchers can also display different simulation _interfaces_ for different experimental conditions; however, coding experience is needed and requires the researcher to make changes to the codebase to develop the different interfaces and logic for display.

| [Previous<br>Initial Experimental Design](/docs/getting-started/initial-experimental-design.md) | [Next<br>Launching Your Study](/docs/getting-started/launching-your-study.md) |
| ----------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
