/**
 * VerfahrensdokuViewer Component
 *
 * Read-only renderer of the GoBD Verfahrensdokumentation.
 * Document-style layout with table of contents, collapsible sections, and print.
 */

import { useState, useEffect } from 'react'
import { cn, getErrorMessage } from '@/lib/utils'
import { api } from '@/lib/api'
import type { VerfahrensdokuResponse } from '@/lib/api'
import { Button } from '@/components/ui/button'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { Loader2, Printer, ChevronDown, FileText } from 'lucide-react'

export interface VerfahrensdokuViewerProps {
  /** Additional CSS classes */
  className?: string
}

export function VerfahrensdokuViewer({ className }: VerfahrensdokuViewerProps) {
  const [doc, setDoc] = useState<VerfahrensdokuResponse | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set())

  useEffect(() => {
    async function fetchDoc() {
      setIsLoading(true)
      setError(null)
      try {
        const data = await api.getVerfahrensdokumentation()
        setDoc(data)
        // Expand all sections by default
        const allIds = new Set<string>()
        data.sections?.forEach(s => {
          allIds.add(s.id)
          s.subsections?.forEach(sub => allIds.add(sub.id))
        })
        setExpandedSections(allIds)
      } catch (err) {
        setError(getErrorMessage(err))
      } finally {
        setIsLoading(false)
      }
    }
    fetchDoc()
  }, [])

  const toggleSection = (id: string) => {
    setExpandedSections(prev => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  const handlePrint = () => window.print()

  if (isLoading) {
    return (
      <div className={cn('flex items-center justify-center p-8', className)}>
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (error) {
    return (
      <div className={cn('rounded-lg border border-destructive p-8 text-center', className)}>
        <p className="text-destructive">{error}</p>
      </div>
    )
  }

  if (!doc) return null

  return (
    <div className={cn('space-y-6', className)}>
      {/* Header */}
      <div className="flex items-start justify-between print:hidden">
        <div>
          <h2 className="text-xl font-semibold">Verfahrensdokumentation</h2>
          <p className="text-sm text-muted-foreground mt-1">
            GoBD-konforme Dokumentation der Buchführungsprozesse
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={handlePrint}>
          <Printer className="mr-2 h-4 w-4" />
          Drucken
        </Button>
      </div>

      {/* Document */}
      <div className="rounded-xl border bg-white shadow-sm p-6 sm:p-8 print:border-0 print:shadow-none">
        {/* Title */}
        <div className="text-center pb-6 border-b mb-6">
          <FileText className="h-8 w-8 mx-auto mb-3 text-muted-foreground" />
          <h1 className="text-2xl font-bold">{doc.title}</h1>
          <p className="text-sm text-muted-foreground mt-2">
            Version: {doc.version} • Erstellt: {new Intl.DateTimeFormat('de-DE').format(new Date(doc.generated_at))}
          </p>
        </div>

        {/* Table of Contents */}
        <div className="mb-8 rounded-lg bg-muted/30 p-4 print:bg-gray-50">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-3">
            Inhaltsverzeichnis
          </h3>
          <nav className="space-y-1">
            {doc.sections?.map((section, idx) => (
              <div key={section.id}>
                <a
                  href={`#${section.id}`}
                  className="text-sm text-primary hover:underline block py-0.5"
                >
                  {idx + 1}. {section.title}
                </a>
                {section.subsections?.map((sub, subIdx) => (
                  <a
                    key={sub.id}
                    href={`#${sub.id}`}
                    className="text-sm text-muted-foreground hover:text-primary hover:underline block py-0.5 pl-6"
                  >
                    {idx + 1}.{subIdx + 1} {sub.title}
                  </a>
                ))}
              </div>
            ))}
          </nav>
        </div>

        {/* Sections */}
        <div className="space-y-6">
          {doc.sections?.map((section, idx) => (
            <Collapsible
              key={section.id}
              open={expandedSections.has(section.id)}
              onOpenChange={() => toggleSection(section.id)}
            >
              <div id={section.id} className="scroll-mt-4">
                <CollapsibleTrigger className="flex items-center gap-2 w-full text-left group print:pointer-events-none">
                  <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform group-data-[state=open]:rotate-0 group-data-[state=closed]:-rotate-90 print:hidden" />
                  <h2 className="text-lg font-semibold">
                    {idx + 1}. {section.title}
                  </h2>
                </CollapsibleTrigger>
                <CollapsibleContent className="mt-3 pl-6">
                  <div
                    className="prose prose-sm max-w-none text-muted-foreground"
                    dangerouslySetInnerHTML={{ __html: section.content }}
                  />

                  {/* Subsections */}
                  {section.subsections?.map((sub, subIdx) => (
                    <div key={sub.id} id={sub.id} className="mt-4 scroll-mt-4">
                      <h3 className="text-base font-semibold mb-2">
                        {idx + 1}.{subIdx + 1} {sub.title}
                      </h3>
                      <div
                        className="prose prose-sm max-w-none text-muted-foreground"
                        dangerouslySetInnerHTML={{ __html: sub.content }}
                      />
                    </div>
                  ))}
                </CollapsibleContent>
              </div>
            </Collapsible>
          ))}
        </div>
      </div>
    </div>
  )
}

export default VerfahrensdokuViewer
