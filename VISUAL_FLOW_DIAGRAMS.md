# 📊 Krugersdorp Daily Blog - Visual Flow Diagrams

This document contains ASCII-based flow diagrams and visual representations of the blog application's architecture and data flow.

## 🏗️ System Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           KRUGERSDORP DAILY BLOG SYSTEM                         │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│  ┌─────────────────┐                    ┌─────────────────┐                    │
│  │                 │                    │                 │                    │
│  │   USER BROWSER  │◄──────────────────►│  EXPRESS SERVER │                    │
│  │                 │  HTTP/HTTPS        │   (Node.js)     │                    │
│  │  - EJS Templates│  Requests/Responses │  - Routes       │                    │
│  │  - CSS Styling  │                    │  - Middleware   │                    │
│  │  - Form Inputs  │                    │  - Logic        │                    │
│  └─────────────────┘                    └─────────┬───────┘                    │
│                                                   │                            │
│                                                   │                            │
│  ┌─────────────────┐                             │                            │
│  │                 │                             │                            │
│  │  FALLBACK       │◄────────────────────────────┼─────────────┐              │
│  │  STORAGE        │        Backup Path          │             │              │
│  │                 │                             │             │              │
│  │  - In Memory    │                             │             │              │
│  │  - Array Based  │                             │             │              │
│  │  - UUID IDs     │                             │             │              │
│  │  - Temporary    │                             │             │              │
│  └─────────────────┘                             │             │              │
│                                                   │             │              │
│                                                   ▼             │              │
│                                          ┌─────────────────┐    │              │
│                                          │                 │    │              │
│                                          │  CONNECTION     │    │              │
│                                          │  MANAGER        │────┘              │
│                                          │                 │                   │
│                                          │  - Retry Logic  │                   │
│                                          │  - Health Check │                   │
│                                          │  - Status Flag  │                   │
│                                          └─────────┬───────┘                   │
│                                                    │                           │
│                                                    │                           │
│                                                    ▼                           │
│                                          ┌─────────────────┐                   │
│                                          │                 │                   │
│                                          │   MONGODB       │                   │
│                                          │   ATLAS         │                   │
│                                          │                 │                   │
│                                          │  - Cloud DB     │                   │
│                                          │  - Persistence  │                   │
│                                          │  - ObjectIDs    │                   │
│                                          │  - Mongoose     │                   │
│                                          └─────────────────┘                   │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

## 🔄 User Journey Flow

### Creating a New Post Journey
```
     ┌─────────────┐
     │    USER     │
     │  clicks     │
     │ "Compose"   │
     └──────┬──────┘
            │
            ▼
┌───────────────────────┐     GET /compose     ┌───────────────────────┐
│                       │ ─────────────────── ▶│                       │
│   Browser requests    │                      │   Server handles      │
│   compose page        │                      │   route and renders   │
│                       │                      │   compose.ejs         │
└───────────────────────┘                      └───────────┬───────────┘
            ▲                                              │
            │                                              ▼
            │                    HTML Response           ┌───────────────────────┐
            │ ◄──────────────────────────────────────── │                       │
            │                                            │   Template engine     │
            │                                            │   processes EJS       │
            │                                            │   with header/footer  │
            ▼                                            └───────────────────────┘
┌───────────────────────┐
│                       │
│   User sees form      │
│   with title & body   │
│   input fields        │
│                       │
└───────────┬───────────┘
            │
            │ User fills form and clicks "Publish"
            ▼
┌───────────────────────┐    POST /compose    ┌───────────────────────┐
│                       │ ──────────────────▶ │                       │
│   Browser submits     │                     │   Server receives     │
│   form data           │                     │   postTitle & postBody│
│                       │                     │                       │
└───────────────────────┘                     └───────────┬───────────┘
            ▲                                             │
            │                                             ▼
            │                                 ┌───────────────────────┐
            │                                 │                       │
            │                                 │   Connection Check    │
            │                                 │   if(isMongoConnected)│
            │                                 │                       │
            │                                 └───────┬───────────────┘
            │                                         │
            │                     ┌───────────────────┼───────────────────┐
            │                     │                   │                   │
            │                     ▼                   ▼                   │
            │        ┌─────────────────────┐ ┌─────────────────────┐      │
            │        │                     │ │                     │      │
            │        │   MongoDB Path      │ │   Fallback Path     │      │
            │        │                     │ │                     │      │
            │        │ new Post().save()   │ │ fallbackPosts.push()│      │
            │        │                     │ │                     │      │
            │        └─────────────────────┘ └─────────────────────┘      │
            │                     │                   │                   │
            │                     └───────────────────┼───────────────────┘
            │                                         │
            │                                         ▼
            │                               ┌───────────────────────┐
            │                               │                       │
            │     Redirect to /             │   Success! Post saved │
            │ ◄──────────────────────────── │   Redirect response   │
            │                               │                       │
            ▼                               └───────────────────────┘
┌───────────────────────┐
│                       │
│   User sees homepage  │
│   with new post       │
│   displayed           │
│                       │
└───────────────────────┘
```

## 📊 Data Flow Architecture

### Request Processing Pipeline
```
HTTP Request
     │
     ▼
┌─────────────────┐
│   Body Parser   │  ◄── Parses form data (title, body)
└─────────┬───────┘
          │
          ▼
┌─────────────────┐
│ Static Serving  │  ◄── Serves CSS, images from /public
└─────────┬───────┘
          │
          ▼
┌─────────────────┐
│  Route Handler  │  ◄── Matches URL to appropriate controller
└─────────┬───────┘
          │
          ▼
┌─────────────────┐
│ Connection      │
│ Status Check    │  ◄── if (isMongoConnected)
└─────────┬───────┘
          │
          ├─────────────────┬─────────────────┐
          │                 │                 │
          ▼                 ▼                 ▼
┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐
│   MongoDB       │ │   Fallback      │ │   Error         │
│   Operation     │ │   Operation     │ │   Handling      │
│                 │ │                 │ │                 │
│ • Post.find()   │ │ • Array ops     │ │ • Catch blocks  │
│ • Post.save()   │ │ • UUID gen      │ │ • Graceful fail │
│ • Post.update() │ │ • Memory store  │ │ • User feedback │
│ • Post.delete() │ │ • Temp persist  │ │ • Logging       │
└─────────┬───────┘ └─────────┬───────┘ └─────────┬───────┘
          │                   │                   │
          └─────────────────┬─┴─────────────────┬─┘
                            │                   │
                            ▼                   ▼
                   ┌─────────────────┐ ┌─────────────────┐
                   │  Template       │ │  Error Response │
                   │  Rendering      │ │                 │
                   │                 │ │ • 500 status    │
                   │ • EJS processing│ │ • Error page    │
                   │ • Data injection│ │ • User message  │
                   │ • Header/Footer │ │                 │
                   └─────────┬───────┘ └─────────┬───────┘
                             │                   │
                             └─────────┬─────────┘
                                       │
                                       ▼
                              ┌─────────────────┐
                              │  HTTP Response  │
                              │                 │
                              │ • HTML content  │
                              │ • Status codes  │
                              │ • Headers       │
                              │ • Redirects     │
                              └─────────────────┘
```

## 🔄 Connection State Management

### MongoDB Connection State Machine
```
                    ┌─────────────────┐
                    │  SERVER START   │
                    │   Initialize    │
                    │   Variables     │
                    └────────┬────────┘
                             │
                             ▼
                    ┌─────────────────┐
                    │  FIRST ATTEMPT  │
                    │  connectToMongo │
                    │  reconnectAtt=0 │
                    └────────┬────────┘
                             │
                    ┌────────▼────────┐
                    │   CONNECTION    │
                    │   SUCCESSFUL?   │
                    └─────┬───────┬───┘
                    YES   │       │ NO
                          │       │
                          ▼       ▼
               ┌─────────────────┐ ┌─────────────────┐
               │ ✅ CONNECTED    │ │ ❌ FAILED       │
               │ Mode: MongoDB   │ │ Mode: Retry     │
               │ isMongoConn=true│ │ isMongoConn=false│
               │ reconnectAtt=0  │ │ reconnectAtt++  │
               └─────────┬───────┘ └─────────┬───────┘
                         │                   │
                         │                   ▼
                         │         ┌─────────────────┐
                         │         │  CHECK RETRY    │
                         │         │  ATTEMPTS       │
                         │         │  < 5 attempts?  │
                         │         └─────┬───────┬───┘
                         │         YES   │       │ NO
                         │               │       │
                         │               ▼       ▼
                         │    ┌─────────────────┐ ┌─────────────────┐
                         │    │ 🔄 RETRY TIMER  │ │ ⚠️ MAX ATTEMPTS │
                         │    │ setTimeout      │ │ Mode: Fallback  │
                         │    │ 30 seconds      │ │ Permanent       │
                         │    │                 │ │ fallback mode   │
                         │    └─────────┬───────┘ └─────────┬───────┘
                         │              │                   │
                         │              └─────────┐         │
                         │                        │         │
                         │                        ▼         │
                         │             ┌─────────────────┐  │
                         │             │  RETRY ATTEMPT  │  │
                         │             │  connectToMongo │  │
                         │             └─────────┬───────┘  │
                         │                       │          │
                         │                       └──────────┼─────────┐
                         │                                  │         │
                         │    ┌─────────────────────────────┘         │
                         │    │                                       │
                         │    ▼                                       │
                         │ ┌─────────────────┐                       │
                         │ │ 🔍 HEALTH CHECK │                       │
                         │ │ Every 5 minutes │                       │
                         │ │ setInterval     │                       │
                         │ │ (300000ms)      │                       │
                         │ └─────────┬───────┘                       │
                         │           │                               │
                         │           ▼                               │
                         │ ┌─────────────────┐                       │
                         │ │ IF DISCONNECTED │                       │
                         │ │ reset attempts  │                       │
                         │ │ & retry connect │                       │
                         │ └─────────┬───────┘                       │
                         │           │                               │
                         │           └───────────────────────────────┘
                         │
                         ▼
              ┌─────────────────┐
              │  NORMAL         │
              │  OPERATION      │
              │  Serving        │
              │  Requests       │
              └─────────┬───────┘
                        │
                        │ ⚠️ Connection Lost Event
                        ▼
              ┌─────────────────┐
              │ DISCONNECTED    │
              │ Event Handler   │
              │ isMongoConn=false│
              │ Start reconnect │
              └─────────────────┘
                        │
                        └─────────────────────────────────────┐
                                                              │
                        ┌─────────────────────────────────────┘
                        │
                        ▼
              ┌─────────────────┐
              │ AUTO FALLBACK   │
              │ All requests    │
              │ use fallback    │
              │ storage until   │
              │ reconnected     │
              └─────────────────┘
```

## 📋 Route Processing Flowchart

### GET / (Homepage) Route Flow
```
     ┌─────────────┐
     │   GET /     │
     │  Request    │
     └──────┬──────┘
            │
            ▼
   ┌─────────────────┐
   │ isMongoConnected│
   │     check       │
   └─────┬───────┬───┘
   YES   │       │ NO
         │       │
         ▼       ▼
┌─────────────┐ ┌─────────────┐
│ MongoDB     │ │ Fallback    │
│ Post.find() │ │ fallback    │
│ .sort()     │ │ Posts array │
└──────┬──────┘ └──────┬──────┘
       │               │
       │               │
       └───────┬───────┘
               │
               ▼
      ┌─────────────────┐
      │   Try Block     │
      │   Success?      │
      └─────┬───────┬───┘
      YES   │       │ NO
            │       │
            ▼       ▼
   ┌─────────────┐ ┌─────────────┐
   │ Render      │ │ Catch Block │
   │ index.ejs   │ │ Emergency   │
   │ with posts  │ │ Fallback    │
   │ & status    │ │ Response    │
   └─────────────┘ └─────────────┘
```

## 🗂️ Template Data Flow

### EJS Template Processing Pipeline
```
Route Handler
     │
     │ res.render("template", {data})
     ▼
┌─────────────────┐
│  EJS Template   │
│  Engine         │
│                 │
│ • Loads .ejs    │
│ • Processes tags│
│ • Includes parts│
└─────────┬───────┘
          │
          ▼
┌─────────────────┐     <%- include("partials/header") %>
│  Header Partial │ ◄─────────────────────────────────────
│                 │
│ • Navigation    │
│ • Status Banner │
│ • Hero Section  │
└─────────┬───────┘
          │
          ▼
┌─────────────────┐     <% if (posts.length > 0) { %>
│  Main Content   │ ◄─────────────────────────────────────
│                 │
│ • Conditional   │     <% posts.forEach(post => { %>
│ • Loops         │ ◄─────────────────────────────────────
│ • Data Display  │
│ • Forms         │     <%= post.title %>
└─────────┬───────┘ ◄─────────────────────────────────────
          │
          ▼
┌─────────────────┐     <%- include("partials/footer") %>
│  Footer Partial │ ◄─────────────────────────────────────
│                 │
│ • Copyright     │
│ • Links         │
│ • Scripts       │
└─────────┬───────┘
          │
          ▼
┌─────────────────┐
│   Final HTML    │
│   Output        │
│                 │
│ • Complete page │
│ • All data      │
│ • Styled        │
└─────────────────┘
```

## 💾 Data Storage Comparison

### MongoDB vs Fallback Storage Architecture
```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           STORAGE ARCHITECTURE                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  MONGODB ATLAS (Primary)              FALLBACK STORAGE (Secondary)          │
│  ┌───────────────────────┐            ┌───────────────────────┐             │
│  │                       │            │                       │             │
│  │  🌐 Cloud Database    │            │  💾 Local Memory      │             │
│  │                       │            │                       │             │
│  │  Data Structure:      │            │  Data Structure:      │             │
│  │  {                    │            │  {                    │             │
│  │    _id: ObjectId,     │            │    _id: UUID,         │             │
│  │    title: String,     │            │    title: String,     │             │
│  │    body: String,      │            │    body: String,      │             │
│  │    createdAt: Date,   │            │    createdAt: Date    │             │
│  │    __v: Number        │            │  }                    │             │
│  │  }                    │            │                       │             │
│  │                       │            │  Storage: Array       │             │
│  │  Persistence: ✅ YES  │            │  Persistence: ❌ NO   │             │
│  │  Performance: 🐌 SLOW │            │  Performance: ⚡ FAST │             │
│  │  Network: ✅ REQUIRED │            │  Network: ❌ NONE     │             │
│  │  Reliability: 🔄 VARIES│           │  Reliability: ✅ HIGH │             │
│  │  Scalability: ✅ HIGH │            │  Scalability: ❌ LOW  │             │
│  │                       │            │                       │             │
│  └───────────┬───────────┘            └───────────┬───────────┘             │
│              │                                    │                         │
│              │          Route Handlers            │                         │
│              │     ┌─────────────────┐            │                         │
│              └────▶│                 │◄───────────┘                         │
│                    │  Dual Logic     │                                      │
│                    │  Implementation │                                      │
│                    │                 │                                      │
│                    │ if(connected) { │                                      │
│                    │   mongoOp()     │                                      │
│                    │ } else {        │                                      │
│                    │   fallbackOp()  │                                      │
│                    │ }               │                                      │
│                    └─────────────────┘                                      │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

## 🔧 Error Handling Flow

### Three-Layer Error Protection System
```
                     ┌─────────────────┐
                     │  INCOMING       │
                     │  REQUEST        │
                     └─────────┬───────┘
                               │
                               ▼
                     ┌─────────────────┐
                     │  LAYER 1:       │
                     │  TRY BLOCK      │
                     │                 │
                     │  Primary path   │
                     │  attempt        │
                     └─────────┬───────┘
                               │
                               │ ✅ Success
                               ▼
┌─────────────────┐  ❌ Error │ ┌─────────────────┐
│  LAYER 2:       │ ◄─────────┼─│  SUCCESS        │
│  CATCH BLOCK    │           │ │  RESPONSE       │
│                 │           │ │                 │
│  Secondary path │           │ │ • Render page   │
│  graceful fail  │           │ │ • Send data     │
└─────────┬───────┘           │ │ • Status 200    │
          │                   │ └─────────────────┘
          │ ✅ Recovered      │
          ▼                   │
┌─────────────────┐           │
│  FALLBACK       │           │
│  RESPONSE       │           │
│                 │           │
│ • Fallback data │           │
│ • Error logged  │           │
│ • User notified │           │
└─────────┬───────┘           │
          │                   │
          │ ❌ Complete Fail  │
          ▼                   │
┌─────────────────┐           │
│  LAYER 3:       │           │
│  TEMPLATE LEVEL │           │
│                 │           │
│  Emergency      │           │
│  fallback in    │           │
│  EJS templates  │           │
└─────────┬───────┘           │
          │                   │
          └─────────┬─────────┘
                    │
                    ▼
          ┌─────────────────┐
          │  FINAL          │
          │  RESPONSE       │
          │                 │
          │ Always delivers │
          │ a working page  │
          │ to the user     │
          └─────────────────┘
```

## 📱 User Interface Flow

### Complete User Experience Journey
```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           USER INTERFACE JOURNEY                           │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  1. HOMEPAGE                2. COMPOSE PAGE           3. POST VIEW           │
│  ┌─────────────────┐       ┌─────────────────┐       ┌─────────────────┐    │
│  │ 🏠 Home        │       │ ✏️ Compose     │       │ 📖 Post View   │    │
│  │                 │       │                 │       │                 │    │
│  │ ┌─────────────┐ │       │ ┌─────────────┐ │       │ ┌─────────────┐ │    │
│  │ │ Navigation  │ │       │ │ Navigation  │ │       │ │ Navigation  │ │    │
│  │ │ Home|Compose│ │       │ │ Home|Compose│ │       │ │ Home|Compose│ │    │
│  │ └─────────────┘ │       │ └─────────────┘ │       │ └─────────────┘ │    │
│  │                 │       │                 │       │                 │    │
│  │ ┌─────────────┐ │       │ ┌─────────────┐ │       │ ┌─────────────┐ │    │
│  │ │ Status      │ │       │ │ Status      │ │       │ │ Status      │ │    │
│  │ │ Banner      │ │       │ │ Banner      │ │       │ │ Banner      │ │    │
│  │ │ ✅Connected │ │       │ │ ⚠️Fallback  │ │       │ │ ✅Connected │ │    │
│  │ └─────────────┘ │       │ └─────────────┘ │       │ └─────────────┘ │    │
│  │                 │       │                 │       │                 │    │
│  │ ┌─────────────┐ │       │ ┌─────────────┐ │       │ ┌─────────────┐ │    │
│  │ │ Post List   │ │       │ │ Create Form │ │       │ │ Full Post   │ │    │
│  │ │             │ │       │ │             │ │       │ │             │ │    │
│  │ │ • Title 1   │ │       │ │ [Title___]  │ │       │ │ # Post Title│ │    │
│  │ │ • Title 2   │ │       │ │             │ │       │ │             │ │    │
│  │ │ • Title 3   │ │       │ │ [Body____]  │ │       │ │ Full content│ │    │
│  │ │             │ │       │ │ [_______]   │ │       │ │ of the post │ │    │
│  │ │ [+ Create]  │ │       │ │ [_______]   │ │       │ │ goes here..│ │    │
│  │ └─────────────┘ │       │ │             │ │       │ └─────────────┘ │    │
│  └─────────────────┘       │ │ [Publish]   │ │       │                 │    │
│           │                 │ └─────────────┘ │       │ ┌─────────────┐ │    │
│           │ Click Post      └─────────────────┘       │ │[Edit][Del]  │ │    │
│           └─────────────────────────────────────────▶ │ └─────────────┘ │    │
│                             ▲                         └─────────────────┘    │
│                             │ Submit Form                      │             │
│                             └──────────────────────────────────┘             │
│                                                                              │
│  4. EDIT PAGE                                                                │
│  ┌─────────────────┐                                                         │
│  │ ✏️ Edit Post   │                                                         │
│  │                 │                                                         │
│  │ ┌─────────────┐ │                                                         │
│  │ │ Navigation  │ │                                                         │
│  │ │ Home|Compose│ │                                                         │
│  │ └─────────────┘ │                                                         │
│  │                 │                                                         │
│  │ ┌─────────────┐ │ ◄─────────────────────────────────────────────────────┘ │
│  │ │ Edit Form   │ │   Click Edit                                            │
│  │ │             │ │                                                         │
│  │ │ [Title___]  │ │   (Pre-filled with existing data)                      │
│  │ │             │ │                                                         │
│  │ │ [Body____]  │ │                                                         │
│  │ │ [_______]   │ │                                                         │
│  │ │ [_______]   │ │                                                         │
│  │ │             │ │                                                         │
│  │ │ [Update]    │ │                                                         │
│  │ └─────────────┘ │                                                         │
│  └─────────────────┘                                                         │
│           │                                                                  │
│           │ Submit Update                                                    │
│           └─────────────────────────────────────────────────────────────────┘
│                                     │
│                                     ▼
│                           ┌─────────────────┐
│                           │  SUCCESS        │
│                           │  REDIRECT       │
│                           │  TO POST VIEW   │
│                           └─────────────────┘
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

These visual diagrams provide a comprehensive understanding of how every component in the Krugersdorp Daily Blog system works together, making it easy for anyone to understand, rebuild, or explain the application architecture to clients or stakeholders.