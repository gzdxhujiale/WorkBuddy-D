-- One-time data migration for templates created before the frontend began
-- persisting canonical task-table quadrant values. This is data cleanup, not
-- a runtime compatibility path.
update public.project_templates template
set definition = jsonb_set(
  template.definition,
  '{tasks}',
  (
    select jsonb_agg(
      case task->>'quadrant'
        when 'Q1' then jsonb_set(task, '{quadrant}', '"Q1_URGENT_IMPORTANT"'::jsonb)
        when 'Q2' then jsonb_set(task, '{quadrant}', '"Q2_NOT_URGENT_IMPORTANT"'::jsonb)
        when 'Q3' then jsonb_set(task, '{quadrant}', '"Q3_URGENT_NOT_IMPORTANT"'::jsonb)
        when 'Q4' then jsonb_set(task, '{quadrant}', '"Q4_NOT_URGENT_NOT_IMPORTANT"'::jsonb)
        else task
      end
    )
    from jsonb_array_elements(template.definition->'tasks') as task
  ),
  false
)
where exists (
  select 1
  from jsonb_array_elements(template.definition->'tasks') as task
  where task->>'quadrant' in ('Q1', 'Q2', 'Q3', 'Q4')
);
