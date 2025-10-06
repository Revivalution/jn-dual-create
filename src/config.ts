import 'dotenv/config';

export const cfg = {
  port: Number(process.env.PORT ?? 8080),
  jnBase: process.env.JOBNIMBUS_API_BASE!,
  jnKey: process.env.JOBNIMBUS_API_KEY!,
  defaults: {
    contactType: process.env.JN_DEFAULT_CONTACT_TYPE ?? 'Residential',
    contactStatus: process.env.JN_DEFAULT_CONTACT_STATUS ?? 'New Lead',
    jobType: process.env.JN_DEFAULT_JOB_TYPE ?? 'General',
    jobStatus: process.env.JN_DEFAULT_JOB_STATUS ?? 'New'
  },
  displayNameMode: (process.env.JN_CONTACT_DISPLAY_NAME_MODE ?? 'displayName') as 'displayName'|'name'
};

