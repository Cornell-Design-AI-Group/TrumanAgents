# Truman Agents

**Truman Agents** is an open-source social media simulation platform where LLM-powered agents interact with multiple human participants in real time. Researchers can design scenarios by defining agent roles (e.g., bully, victim, bystander), backstories, behavior prompts, and personality traits. During a simulation, agents act autonomously based on these traits while multiple participants independently navigate the same social situation, and the platform collects detailed behavioral data throughout.

Built on the [Truman Platform](https://github.com/cornellsml/truman), Truman Agents extends it with LLM-driven autonomous agents, game mechanics (levels, objectives, scoring), real-time multi-user support, and a separate Python service ([TrumanWorld](https://github.com/Cornell-Design-AI-Group/TrumanWorld)) that drives autonomous agent behavior.

This platform is created by the [DesignAI Group at Cornell](https://designai.cis.cornell.edu/).

## Key Features

- **Scenario Authoring**: Define characters, posts, agent prompts, objectives, and personality traits via CSV and JSON files. See `scenarios/EXAMPLE/` for a template.
- **Flexible Agent Roles**: Agents can play roles such as bully, victim, bystander, or informer, each with custom backstories, behavior prompts, and personality traits that influence their social reactivity. Any role can be LLM-driven or scripted.
- **Autonomous Agent Behavior** (via [TrumanWorld](https://github.com/Cornell-Design-AI-Group/TrumanWorld)): A separate Python service that drives agents to autonomously post, comment, like, share, and flag on the feed based on the evolving simulation state.
- **LLM-Powered Chat**: Agents respond to participant direct messages in character, powered by OpenAI.
- **Game Mechanics**: Levels, objectives, scoring, and win/loss conditions to structure participant experiences. An LLM grader evaluates participant actions against scenario-defined objectives every 10 seconds.
- **Multi-User Sessions**: Run parallel simulations for multiple participants with independent session tracking and real-time score and feed updates via Socket.IO.
- **Behavioral Data Collection**: Logs participant interactions, time on site, feed actions, and chat messages for export.
- **Configurable Branding**: Customize site name, logo, favicon, and homepage image per study via environment variables.

## Tech Stack

Node.js, Express, MongoDB, Socket.IO, OpenAI API, Pug templates, Fomantic UI

## Quickstart

**Prerequisites:** Node.js 20+, MongoDB, an OpenAI API key

```bash
# Clone the repo
git clone https://github.com/Cornell-Design-AI-Group/TrumanAgents.git
cd TrumanAgents

# Install dependencies
npm install

# Configure environment
cp .env.example .env
# Edit .env with your MongoDB URI, OpenAI API key, and session settings

# Populate the database with a scenario
node populate.js

# Start the server
npm run dev
```

The app will be running at `http://localhost:3000`.

## Scenario Structure

Each scenario lives in its own folder under `scenarios/`. See `scenarios/EXAMPLE/` for a documented template. A scenario consists of:

| File | Purpose |
|------|---------|
| `actors.csv` | Scripted characters (name, bio, profile picture) |
| `agents.csv` | LLM-powered or scripted characters with role, backstory, behavior prompt, and personality traits |
| `posts.csv` | Initial posts that appear in the feed |
| `replies.csv` | Scripted replies to posts |
| `objectives.csv` | Goals the participant must achieve |
| `solutions.json` | Criteria for evaluating participant actions |
| `scenarios.csv` | Metadata (scenario name, description) |
| `README.md` | Documentation for this scenario |

## Documentation

For full setup instructions, experimental design guides, and deployment options, see the [documentation](./docs/index.md).

## Companion: TrumanWorld

[TrumanWorld](https://github.com/Cornell-Design-AI-Group/TrumanWorld) is a separate Python service that drives autonomous agent behavior. It polls the simulation state from MongoDB, uses an LLM to decide what agents should do next (post, comment, react), and posts actions back to Truman Agents via its REST API. Truman Agents works without TrumanWorld (using scripted actors and the built-in chat/grading LLM calls), but TrumanWorld enables fully autonomous multi-agent simulations.

## Citation

If you use Truman Agents in your research, please cite:

```bibtex
@article{yang2026notskills,
  title={Not Skills, But Attention: What Prevents Young Adults from Speaking Up Against Cyberbullying in an LLM-Powered Social Media Simulation},
  author={Yang, Qian and Jia, Jessie and Tsai, Elaine and Li, Amy and Akoury, Nader and Bazarova, Natalie N.},
  year={2026},
  note={Preprint available soon}
}
```

## License

[MIT](LICENSE)

## Acknowledgments

Truman Agents builds on the [Truman Platform](https://github.com/cornellsml/truman) originally developed by [Dominic DiFranzo](https://difranzo.com/) and the [Cornell Social Media Lab](https://socialmedialab.cornell.edu/), supported by NSF IIS-1405634. Project organization is based on [Hackathon Starter](https://github.com/sahat/hackathon-starter) by Sahat Yalkabov.

## Contact

Maintained by [Qian Yang](mailto:qianyang@cornell.edu), Cornell University.