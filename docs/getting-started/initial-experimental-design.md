# Initial Experimental Design

As a researcher, you can manipulate features of The Truman Platform to fit the needs of your research.

## Research Question

The Truman Platform can be used to study a variety of research questions. You can view past research that have used Truman [here](/docs/getting-started/citation-and-papers).

Once you have decided on your research question, begin to think about how The Truman Platform can be used to facilitate studying your research question.

### Independent Variable

The variable that you manipulate is considered the **independent variable (IV)**.

Components of The Truman Platform that can be readily manipulated for your experiment are:

- the identities of the simulated people on the platform (called actors)
- the actors' posts and comments
- the interactions between actors
- and the interactions between actors and the research participant.

See more in [Defining your Simulation](/docs/setting-up-truman/defining-your-simulation/index.md) for instructions and details.

You may also manipulate the interface of the environment; however, coding experience is needed to change the user interface or user experience according to experimental groups. Note that the user interface of the current version of Truman largely resembles the web interface of Instagram.

### Dependent Variables

The variables that are affected by the independent variable are known as the **dependent variables (DV)**.

On Truman, the DVs that are typically measured are the responses of research participants and/or their resulting behavior on the platform. Depending on your independent variable, dependent variables can include what the participants post, like, comment, or flag. It can also be the time they spend on the website or the frequency of pages or profiles they click on, etc.

A brief summary of the default data collected on The Truman Platform is listed below. Decide which behaviors are applicable to your research question to measure as dependent variables:

- All interactions with posts and comments (including likes, flags, view times)
- Participants' posting behavior
- Actor based interactions (Block, report, follow, profile view)
- Site log (time on site)
- Page log (pages visited)
- Participant information (MTurkID, username, experimental condition, profile)

A script is provided in the project folder that readily exports the above default data from your database into a readable csv file.

You may also measure behaviors other than the ones listed above on the platform as your dependent variables, but coding experience will be needed to add those functionalities to Truman.

## Other Considerations

### Cover Story

Building a cover story for The Truman Platform is extremely important for reinforcing the realism of the platform. Typically, we use a cover story about beta testing a new social media application, called **EatSnap.Love**, where people share, like, and react to pictures of food. As a result, The Truman Platform's base template's simulation content is centered around food. You can change this when [defining the content of your simulation](/docs/setting-up-truman/defining-your-simulation/simulation-components.md).

### Ethics

Getting ethical approval for Truman studies is essential as Truman studies deal with deceiving participants into believing the actors on the site are real users of the site. A key element to getting ethical approval is to have a clear debrief in the post survey at the end of your study and allowing participants to make an informed consent after this debrief.

| [Previous<br>The Truman Platform](/docs/index.md) | [Next<br>Developing Your Simulation](/docs/getting-started/developing-your-simulation.md) |
| ------------------------------------------------- | ----------------------------------------------------------------------------------------- |
