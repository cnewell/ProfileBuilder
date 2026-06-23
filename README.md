This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

This application uses the Anthropic Claude API, and expects that an API key is available
on the environment variable ANTHROPIC_API_KEY

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Architecture

I chose Next.js and Typescript as the basis. I had worked with Node.js and Typescript before, but not Next.js,
but that's the easiest for the interview team to vet and I felt it would be a useful exercise.

I chose to represent preferences as lists of _preferred_ and _forbidden_ subsets of a list of legal values for each parameter.
This is flexible, but allows finding simple classes of conflicts (where the same value shows up as both _preferred_ and _forbidden_)
in simple code without relying on the LLM to find the conflicts, as well as making it easy to build a resolution UX around them.

Architectural decisions are also captured under doc/adr as Architectural Decision Records.

## Follow-on Work

I cut the integration with the destination lookup API for time, in order to focus on getting the basic flow working with
full conversations and conflict handling within the two hours. My first approach to that would be to implement the
destination lookup as a tool that the LLM could use when finding destinations in prompts, augmenting the context. 

This is, as the requirements call for, single user only, so I would have to make changes to add the notion of users
and authentication.

The JSON streaming for the structured version of preferences still occasionally pulls in surrounding commentary.
I believe this would be fixed by getting an output_config parameter set up for the Anthropic client call in question.

The set of supported preferences is short, intended just to provide a few examples as proof-of-concept, but it should
be straightforward to expand that.

There's a more general question with preferences of dealing with _default_ preferences and exceptions. An example I
used regularly during user testing was to specify that I could not travel during December, January, or February in one
place but state elsewhere that I wanted to go someplace special for New Year's Eve. The LLM correctly detected that
New Year's Eve occurs during December, making December both a preferred and forbidden travel month, but it's entirely
possible that and overnight trip for the holiday might be an exception to whatever normally prevents travel during
those months. There can also be cross-preference effects -- for example, different preferred times of the year for
different regions.

The client is currently using Local Storage to persist the current state of the preferences. Longer term, I would look
at other storage options, especially when using to a multi-user solution.

The user interface can use a lot of polish.