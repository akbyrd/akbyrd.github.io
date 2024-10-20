{{- $prefix := .File.ContentBaseName -}}
{{- $prefix = findRE `^\d+-` $prefix 1 -}}
{{- $prefix = default "" (index $prefix 0) -}}

{{- $alias := $prefix -}}
{{- $alias = substr $alias 0 -1 -}}
{{- $alias = strings.TrimLeft "0" $alias -}}

{{- $title := .File.ContentBaseName -}}
{{- $title = substr $title (len $prefix) -}}
{{- $title = replace $title "-" " " -}}
{{- $title = $title | title -}}

+++
title = '{{ $title }}'
{{- if $alias }}
aliases = [ '{{ $alias }}' ]
{{- end }}
draft = true
+++
