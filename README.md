# Trace & Insight
You are the lead product engineer, senior MERN stack architect, and UI/UX engineer responsible for building this project.

PROJECT NAME: tracify

FIRST AND MOST IMPORTANT INSTRUCTION:

Read and deeply understand the attached PRD/document before writing or generating the application.

The attached PRD is the primary source of truth for:

- The problem being solved

- Target users

- Product vision

- User roles

- Functional requirements

- Investigation workflow

- Blockchain intelligence concepts

- Core modules

- Features

- User journeys

- Technical requirements

- UI/UX direction

- Future innovations

Do not ignore, simplify, or replace the PRD with a generic dashboard.

Before implementing anything, internally understand the complete product architecture and how all modules connect together.

==================================================

PRODUCT OVERVIEW

==================================================

VASPTRACE is an intelligent blockchain investigation and financial intelligence platform.

The platform is designed to help investigators analyze blockchain activity and transform fragmented transaction data into understandable, traceable, investigation-ready intelligence.

The core product should eventually allow users to:

- Create and manage investigation cases

- Start blockchain investigations using wallet addresses or other supported identifiers

- Retrieve and process blockchain transaction data

- Build transaction and wallet relationship graphs

- Trace movement of virtual assets across multiple hops

- Identify important fund flow paths

- Analyze suspicious patterns

- Associate wallets with known or candidate entities

- Investigate potential connections with Virtual Asset Service Providers (VASPs)

- Generate findings

- Collect and organize digital evidence

- Build investigation reports

The final product should feel like a professional intelligence and forensic investigation platform, NOT a generic admin dashboard or simple blockchain explorer.

The experience should communicate:

COMPLEX INTELLIGENCE UNDERNEATH.

ABSOLUTE CLARITY ON THE SURFACE.

==================================================

TECH STACK

==================================================

Build the project with a clean MERN architecture.

Frontend:

- React

- TypeScript

- Vite

- Tailwind CSS

- shadcn/ui or equivalent reusable component architecture

- Framer Motion for meaningful motion

- React Router

- TanStack Query for API/server state

- Zustand for lightweight client state

- React Hook Form

- Zod validation

- Lucide icons

Backend:

- Node.js

- Express.js

- TypeScript if practical

- MongoDB

- Mongoose

- JWT authentication

- bcrypt password hashing

- REST API architecture

Architecture requirement:

Keep frontend and backend clearly separated.

Suggested structure:

root/

  client/

  server/

  shared/ (optional)

The frontend must communicate with the backend through a properly structured API layer.

Do not build the entire application using frontend-only fake logic.

==================================================

CURRENT DEVELOPMENT GOAL

==================================================

IMPORTANT:

Do NOT attempt to build the entire final AI/blockchain intelligence system in one step.

For the first implementation phase, build a complete, polished, scalable foundation of the product.

The goal is to create:

1. Authentication foundation

2. Main application shell

3. Navigation architecture

4. Dashboard

5. Case management

6. Investigation creation flow

7. Investigation workspace foundation

8. Evidence management foundation

9. Findings foundation

10. Backend API structure

11. MongoDB data models

12. Clean reusable component system

Complex blockchain analytics, AI models, graph intelligence algorithms, VASP identification engines, and external blockchain integrations should initially be represented through realistic architecture, interfaces, API placeholders, and mock/sample data.

However, structure the application so real services can later replace the placeholders without redesigning the entire system.

==================================================

USER ROLES

==================================================

Initially implement the architecture for these roles:

1. Investigator

2. Admin

The UI should be designed so additional roles can easily be added later.

Role-based authorization should exist at the backend level.

==================================================

AUTHENTICATION

==================================================

Build:

- Login

- Logout

- Protected routes

- JWT authentication

- Password hashing

- User session handling

- Basic role-based authorization

Authentication UI should be minimal, secure-looking, and professional.

Do not make it look like a generic SaaS login screen.

==================================================

MAIN APPLICATION STRUCTURE

==================================================

Create the following primary sections:

1. Dashboard

2. Cases

3. Investigations

4. Findings

5. Evidence

6. Reports

7. Settings

The navigation should support the workflow described in the PRD.

==================================================

DASHBOARD

==================================================

The dashboard should answer:

"What requires the investigator's attention right now?"

Include:

- Active investigations

- High-priority cases

- Recent findings

- Investigation activity

- Recent cases

- Quick action to create a new case

- Quick action to start an investigation

Avoid meaningless vanity metrics.

Use realistic sample data connected to the application's data structure.

==================================================

CASE MANAGEMENT

==================================================

Build a complete case management foundation.

Users should be able to:

- Create a case

- View all cases

- Search cases

- Filter cases

- Sort cases

- Open a case

- View case details

- View linked investigations

- View linked findings

- View linked evidence

- Update case status

- Set case priority

Suggested Case fields:

- caseId

- title

- description

- priority

- status

- createdBy

- assignedTo

- createdAt

- updatedAt

Use a clean REST API.

Example endpoints:

POST   /api/cases

GET    /api/cases

GET    /api/cases/:id

PATCH  /api/cases/:id

DELETE /api/cases/:id

==================================================

INVESTIGATION CREATION FLOW

==================================================

From a case, the investigator should be able to start a new investigation.

The initial investigation form should support:

- Target blockchain address

- Blockchain/network

- Investigation name

- Investigation description

- Trace depth

- Time window

- Optional advanced parameters

Example investigation statuses:

- Draft

- Queued

- Processing

- Complete

- Failed

Create backend architecture for investigations.

Example fields:

- investigationId

- caseId

- targetAddress

- blockchain

- traceDepth

- timeWindow

- status

- createdAt

- completedAt

- summary

==================================================

INVESTIGATION WORKSPACE

==================================================

This is the most important future screen of VASPTRACE.

For now, build the complete UI architecture and interaction foundation.

The workspace should include:

TOP BAR:

- Back to case

- Case/investigation reference

- Investigation status

- Target address

- Export action

- Add evidence action

LEFT TOOL RAIL:

- Explore

- Paths

- Entities

- Timeline

- Findings

- Evidence

CENTER:

- Investigation canvas

For the first version, use realistic mock graph/sample investigation data.

The canvas should be architected so React Flow or another graph visualization system can later power it.

RIGHT PANEL:

Contextual Inspector Panel.

When a user selects a:

- Wallet

- Transaction

- Entity

- Path

The inspector should update dynamically.

BOTTOM:

Expandable timeline foundation.

The timeline should be designed so it can later synchronize with graph data.

==================================================

FINDINGS

==================================================

Create a structured findings system.

Each finding should contain:

- Finding ID

- Title

- Description

- Severity

- Confidence

- Related investigation

- Related wallets/entities/transactions

- Evidence references

- Created timestamp

Severity:

- Low

- Medium

- High

- Critical

Clicking a finding should eventually connect to the relevant investigation context.

For the current prototype, simulate this interaction with realistic sample data.

==================================================

EVIDENCE VAULT

==================================================

Build the evidence management architecture.

Evidence may eventually include:

- Transaction records

- Wallet records

- Screenshots

- Graph snapshots

- Investigator notes

- Documents

- URLs/references

Each evidence item should support:

- Title

- Type

- Description

- Linked case

- Linked investigation

- Source

- Added by

- Created timestamp

- Metadata

For now, build the database model, APIs, UI, and placeholder attachment structure.

==================================================

REPORTS

==================================================

Create the foundation for a report builder.

The user should eventually be able to generate a report containing:

- Case summary

- Investigation summary

- Key findings

- Important transaction paths

- Entity intelligence

- Evidence

- Investigator notes

For this first phase:

Create the report builder UI and backend data structure.

Actual PDF generation can be implemented later.

==================================================

DATABASE MODELS

==================================================

Create MongoDB/Mongoose models for:

User

Case

Investigation

Finding

Evidence

Report

Design relationships carefully.

Use references where appropriate.

Avoid deeply nested, difficult-to-maintain schemas.

==================================================

API ARCHITECTURE

==================================================

Structure the Express backend properly.

Suggested pattern:

server/

  src/

    config/

    controllers/

    services/

    models/

    routes/

    middleware/

    utils/

    types/

Use:

Route

→ Controller

→ Service

→ Database

Keep business logic out of route files.

Implement:

- Authentication middleware

- Authorization middleware

- Error handling middleware

- Request validation

- Consistent API responses

Example API response:

{

  "success": true,

  "message": "Case created successfully",

  "data": {}

}

==================================================

UI/UX DESIGN DIRECTION

==================================================

The application should feel like a next-generation intelligence and investigation platform.

DO NOT create:

- Generic Bootstrap dashboard

- Excessive glassmorphism

- Cyberpunk neon hacker interface

- Random gradients everywhere

- Excessive cards

- Overly rounded UI

- Generic admin templates

The visual direction should be:

70% Clean intelligence software

15% Subtle depth and glass surfaces

10% Spatial motion

5% ambient visual effects

==================================================

COLOR SYSTEM

==================================================

Primary background:

#080A0F

Main workspace:

#0C0F16

Secondary surface:

#121722

Elevated surface:

#171D29

Primary accent:

#5B8CFF

Secondary intelligence accent:

#8B7CFF

High/Critical:

#FF5C6C

Warning:

#FFB547

Verified/Positive:

#3DDC97

Text and borders should maintain strong accessibility and contrast.

==================================================

TYPOGRAPHY

==================================================

Primary UI font:

Inter

Technical/data font:

JetBrains Mono

Use JetBrains Mono specifically for:

- Wallet addresses

- Transaction hashes

- IDs

- Technical metadata

- Blockchain data

==================================================

LAYOUT SYSTEM

==================================================

Desktop-first design.

Target primary canvas:

1440 x 900

Application layout:

- Sidebar: approximately 264px expanded

- Collapsed sidebar: approximately 76px

- Topbar: approximately 72px

- Responsive behavior for tablet and mobile

Use a consistent spacing system.

Do not overcrowd the interface.

==================================================

MOTION

==================================================

Use Framer Motion carefully.

Motion should be:

- Fast

- Purposeful

- Spatial

Use animation to explain state changes.

Examples:

- Sidebar transitions

- Inspector panel slides

- Modal transitions

- Finding-to-context interactions

- Investigation workspace transitions

Do not animate everything.

==================================================

COMPONENT SYSTEM

==================================================

Create reusable components such as:

AppShell

Sidebar

Topbar

PageHeader

CaseCard

CaseTable

StatusBadge

PriorityBadge

InvestigationCard

InvestigationCanvas

InspectorPanel

Timeline

FindingCard

EvidenceItem

EmptyState

LoadingState

CommandPalette

Modal

ConfirmDialog

Do not duplicate UI logic unnecessarily.

==================================================

COMMAND PALETTE

==================================================

Implement a command palette foundation.

Keyboard shortcut:

Ctrl + K

or

Cmd + K

Support actions such as:

- Create Case

- Start Investigation

- Search Cases

- Navigate to Findings

- Navigate to Evidence

Structure it so wallet/entity search can be added later.

==================================================

DATA AND MOCKING

==================================================

Until real blockchain APIs and intelligence engines are integrated:

Use realistic sample data.

Do not use meaningless lorem ipsum or random fake dashboard values.

Create sample cases, investigations, findings, wallets, entities, and evidence that tell coherent investigation stories.

The same sample investigation data should connect across:

Case

→ Investigation

→ Findings

→ Evidence

→ Investigation Workspace

This is extremely important.

The prototype should feel like a real working product.

==================================================

FUTURE ARCHITECTURE

==================================================

Design the system so these modules can later be integrated:

- Blockchain data providers

- Transaction ingestion services

- Multi-chain support

- Graph database if required

- Graph analytics

- Pathfinding

- Address clustering

- Entity resolution

- VASP identification

- Risk scoring

- AI/ML analysis

- Anomaly detection

- Report generation

- External intelligence databases

Do not hardcode the current implementation in a way that prevents these additions.

Create clear abstraction layers.

For example:

BlockchainProvider interface

BlockchainAnalysisService

GraphService

EntityResolutionService

RiskAnalysisService

These can initially return mock data but should be easy to replace later.

==================================================

IMPLEMENTATION PRIORITY

==================================================

Build in this order:

PHASE 1

1. Project architecture

2. MERN setup

3. Environment configuration

4. MongoDB connection

5. Backend Express server

6. Authentication

7. User model

8. Protected frontend routes

PHASE 2

9. Application shell

10. Sidebar

11. Top navigation

12. Design system

13. Dashboard

PHASE 3

14. Case CRUD

15. Case list

16. Case detail

17. Case creation

PHASE 4

18. Investigation creation

19. Investigation model

20. Investigation APIs

21. Investigation list

PHASE 5

22. Investigation workspace UI

23. Graph canvas placeholder

24. Contextual inspector

25. Timeline foundation

26. Findings interaction

PHASE 6

27. Findings management

28. Evidence vault

29. Report builder foundation

==================================================

CODE QUALITY

==================================================

Requirements:

- TypeScript wherever possible

- Clean folder structure

- Reusable components

- No unnecessary giant files

- Separate frontend and backend concerns

- Environment variables

- No hardcoded secrets

- Proper loading states

- Proper error states

- Empty states

- Form validation

- Responsive UI

- Accessible components

==================================================

IMPORTANT DEVELOPMENT RULE

==================================================

Do not build everything as disconnected static pages.

The application should already have a real product architecture.

For example:

Create Case

→ saved in backend/database

→ appears in Cases

→ can be opened

→ investigation can be created

→ investigation appears under that case

→ findings/evidence can be linked

Even if advanced blockchain intelligence is currently mocked, the PRODUCT FLOW and DATA FLOW must already be real.

==================================================

FINAL EXPECTATION

==================================================

Start by setting up the project architecture and implementing the first functional version.

Prioritize:

1. Correct architecture

2. Clean MERN foundation

3. Real authentication

4. Real database CRUD

5. Connected product workflow

6. Premium UI/UX

7. Scalability for future blockchain intelligence features

Do not attempt to fake advanced AI or blockchain functionality.

Instead, create proper service interfaces and realistic mock implementations that can later be replaced by real blockchain APIs, graph engines, VASP intelligence, and AI/ML services.

The final result of this phase should feel like the foundation of a real, production-grade blockchain intelligence investigation platform called VASPTRACE.

Read the attached PRD carefully throughout development and use its requirements to guide all product decisions.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
