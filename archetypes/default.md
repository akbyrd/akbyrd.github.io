{{- $prefix := .File.ContentBaseName -}}
{{- $prefix = findRE `^\d+-` $prefix 1 -}}
{{- $prefix = default "" (index $prefix 0) -}}

{{- $title := .File.ContentBaseName -}}
{{- $title = substr $title (len $prefix) -}}
{{- $title = replace $title "-" " " -}}
{{- $title = $title | title -}}

+++
title = '{{ $title }}'
draft = true
+++
