import{f as r}from"./vendor-date-fns-BDn9Xvdo.js";const S={1:"High",2:"Medium",3:"Low"},_={backlog:"Backlog",queue:"Queue",in_progress:"In Progress",done:"Done"};function q(e,m={}){const{project:a,client:i}=m,c=r(new Date(e.createdAt),"MMMM d, yyyy"),y=e.dueDate?r(new Date(e.dueDate),"MMMM d, yyyy"):null,d=e.completedAt?r(new Date(e.completedAt),"MMMM d, yyyy"):null;return`---
tags: [${["task",e.area,e.status,`priority-${S[e.priority].toLowerCase()}`].join(", ")}]
status: ${e.status}
priority: ${e.priority}
area: ${e.area}
${a?`project: "${a.name}"`:""}
${i?`client: "${i.name}"`:""}
${e.dueDate?`due_date: ${e.dueDate}`:""}
${e.completedAt?`completed_at: ${e.completedAt}`:""}
created: ${e.createdAt}
---

# ${e.title}

## Details

| Field | Value |
|-------|-------|
| **Status** | ${_[e.status]||e.status} |
| **Priority** | ${S[e.priority]} |
| **Area** | ${e.area.charAt(0).toUpperCase()+e.area.slice(1)} |
${a?`| **Project** | ${a.name} |`:""}
${i?`| **Client** | ${i.name} |`:""}
${y?`| **Due Date** | ${y} |`:""}
${d?`| **Completed** | ${d} |`:""}
| **Created** | ${c} |

${e.description?`## Description

${e.description}`:""}

${e.tags&&e.tags.length>0?`## Tags

${e.tags.map(u=>`- ${u.name}`).join(`
`)}`:""}

---

*Generated on ${r(new Date,"MMMM d, yyyy 'at' HH:mm")}*
`}const v={pipeline:"Pipeline",active:"Active",on_hold:"On Hold",completed:"Completed",cancelled:"Cancelled"};function L(e,m={}){var D,w,p,A,l,t,s,g;const{client:a,tasks:i=[]}=m,c=r(new Date(e.createdAt),"MMMM d, yyyy"),y=e.startDate?r(new Date(e.startDate),"MMMM d, yyyy"):null,d=e.targetEndDate?r(new Date(e.targetEndDate),"MMMM d, yyyy"):null,f=n=>new Intl.NumberFormat("en-US",{style:"currency",currency:e.budgetCurrency}).format(n),u=["project",e.area,e.status],$=i.reduce((n,o)=>(n[o.status]||(n[o.status]=[]),n[o.status].push(o),n),{}),h=i.length>0?`## Tasks

### In Progress (${((D=$.in_progress)==null?void 0:D.length)||0})
${((w=$.in_progress)==null?void 0:w.map(n=>`- [ ] ${n.title}`).join(`
`))||"_No tasks in progress_"}

### Queue (${((p=$.queue)==null?void 0:p.length)||0})
${((A=$.queue)==null?void 0:A.map(n=>`- [ ] ${n.title}`).join(`
`))||"_No tasks in queue_"}

### Backlog (${((l=$.backlog)==null?void 0:l.length)||0})
${((t=$.backlog)==null?void 0:t.map(n=>`- [ ] ${n.title}`).join(`
`))||"_No tasks in backlog_"}

### Done (${((s=$.done)==null?void 0:s.length)||0})
${((g=$.done)==null?void 0:g.map(n=>`- [x] ${n.title}`).join(`
`))||"_No completed tasks_"}
`:"";return`---
tags: [${u.join(", ")}]
status: ${e.status}
area: ${e.area}
${a?`client: "${a.name}"`:""}
${e.budgetAmount?`budget: ${e.budgetAmount}`:""}
${e.budgetCurrency?`currency: ${e.budgetCurrency}`:""}
${e.startDate?`start_date: ${e.startDate}`:""}
${e.targetEndDate?`target_end_date: ${e.targetEndDate}`:""}
created: ${e.createdAt}
---

# ${e.name}

## Overview

| Field | Value |
|-------|-------|
| **Status** | ${v[e.status]||e.status} |
| **Area** | ${e.area.charAt(0).toUpperCase()+e.area.slice(1)} |
${a?`| **Client** | ${a.name} |`:""}
${e.budgetAmount?`| **Budget** | ${f(e.budgetAmount)} |`:""}
${y?`| **Start Date** | ${y} |`:""}
${d?`| **Target End** | ${d} |`:""}
| **Created** | ${c} |

${e.description?`## Description

${e.description}`:""}

${h}

---

*Generated on ${r(new Date,"MMMM d, yyyy 'at' HH:mm")}*
`}const C={draft:"Draft",review:"In Review",approved:"Approved",in_progress:"In Progress",completed:"Completed"},R={critical:"🔴 Critical",high:"🟠 High",medium:"🟡 Medium",low:"🟢 Low"};function U(e,m={}){const{project:a}=m,i=r(new Date(e.createdAt),"MMMM d, yyyy"),c=r(new Date(e.updatedAt),"MMMM d, yyyy"),y=["prd",e.area,e.status];e.assignee&&y.push(`assigned-${e.assignee}`);let d="";e.userStories&&e.userStories.length>0&&(d=`## User Stories

${e.userStories.map((s,g)=>{const n=s.acceptanceCriteria.map(o=>`- [ ] ${o}`).join(`
`);return`### Story ${g+1}
**As a** ${s.persona}
**I want to** ${s.action}
**So that** ${s.benefit}

**Acceptance Criteria:**
${n}`}).join(`

`)}`);let f="";if(e.requirements&&e.requirements.length>0){const t=e.requirements.filter(o=>o.type==="functional"),s=e.requirements.filter(o=>o.type==="non-functional");let g="";t.length>0&&(g=`### Functional Requirements

| # | Requirement | Priority |
|---|-------------|----------|
${t.map((M,b)=>`| FR${b+1} | ${M.description} | ${R[M.priority]||M.priority} |`).join(`
`)}`);let n="";s.length>0&&(n=`### Non-Functional Requirements

| # | Requirement | Priority |
|---|-------------|----------|
${s.map((M,b)=>`| NFR${b+1} | ${M.description} | ${R[M.priority]||M.priority} |`).join(`
`)}`),f=`## Requirements

${g}

${n}`}const u=[];e.technicalApproach&&u.push(`### Technical Approach
${e.technicalApproach}`),e.dependencies&&e.dependencies.length>0&&u.push(`### Dependencies
${e.dependencies.map(t=>`- ${t}`).join(`
`)}`),e.risks&&e.risks.length>0&&u.push(`### Risks
${e.risks.map(t=>`- ⚠️ ${t}`).join(`
`)}`),e.assumptions&&e.assumptions.length>0&&u.push(`### Assumptions
${e.assumptions.map(t=>`- ${t}`).join(`
`)}`),e.constraints&&e.constraints.length>0&&u.push(`### Constraints
${e.constraints.map(t=>`- ${t}`).join(`
`)}`);const $=u.length>0?`## Technical Considerations

${u.join(`

`)}`:"",h=[];if(e.successMetrics&&e.successMetrics.length>0&&h.push(`### Success Metrics
${e.successMetrics.map(t=>`- 📊 ${t}`).join(`
`)}`),e.estimatedEffort&&h.push(`### Estimated Effort
${e.estimatedEffort}`),e.milestones&&e.milestones.length>0){const t=e.milestones.map(s=>{const g=s.targetDate?r(new Date(s.targetDate),"MMM d, yyyy"):"TBD";return`| ${s.title} | ${s.description||"-"} | ${g} |`}).join(`
`);h.push(`### Milestones

| Milestone | Description | Target Date |
|-----------|-------------|-------------|
${t}`)}const D=h.length>0?`## Success Metrics & Timeline

${h.join(`

`)}`:"",w=e.nonGoals&&e.nonGoals.length>0?`### Non-Goals

${e.nonGoals.map(t=>`- ${t}`).join(`
`)}`:"",p=e.goals.map((t,s)=>`${s+1}. ${t}`).join(`
`),A=e.assignee?` | **Assignee:** ${e.assignee.charAt(0).toUpperCase()+e.assignee.slice(1)}`:"",l=[`| **Feature Name** | ${e.featureName} |`,`| **Version** | ${e.version} |`,`| **Area** | ${e.area.charAt(0).toUpperCase()+e.area.slice(1)} |`];return a&&l.push(`| **Project** | ${a.name} |`),l.push(`| **Status** | ${C[e.status]||e.status} |`),l.push(`| **Author** | ${e.author} |`),e.assignee&&l.push(`| **Assignee** | ${e.assignee.charAt(0).toUpperCase()+e.assignee.slice(1)} |`),l.push(`| **Created** | ${i} |`),l.push(`| **Last Updated** | ${c} |`),`---
tags: [${y.join(", ")}]
feature_name: "${e.featureName}"
version: "${e.version}"
status: ${e.status}
area: ${e.area}
author: "${e.author}"
${e.assignee?`assignee: "${e.assignee}"`:""}
${a?`project: "${a.name}"`:""}
created: ${e.createdAt}
updated: ${e.updatedAt}
---

# PRD: ${e.featureName}

> **Version:** ${e.version} | **Status:** ${C[e.status]||e.status} | **Author:** ${e.author}${A}

## Overview

| Field | Value |
|-------|-------|
${l.join(`
`)}

## Problem Statement

${e.problemStatement}

## Goals

${p}

${w}

## Target Users

${e.targetUsers}

${d}

${f}

${$}

${D}

---

*PRD generated on ${r(new Date,"MMMM d, yyyy 'at' HH:mm")}*
`}function T(e,m){const a=new Blob([e],{type:"text/markdown;charset=utf-8"}),i=URL.createObjectURL(a),c=document.createElement("a");c.href=i,c.download=m,document.body.appendChild(c),c.click(),document.body.removeChild(c),URL.revokeObjectURL(i)}function N(e,m="md"){return e.toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"").slice(0,50)+`.${m}`}export{L as a,U as b,T as d,q as e,N as g};
