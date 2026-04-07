import type { SupabaseClient } from '@supabase/supabase-js';
import type { NotifyContext } from './types';
import { sendWhatsApp } from '../whatsapp';
import { getJobNumber, getDisplayName, getPermanentPostingInfo } from './loaders';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.dockwalker.io';

interface TemplateResolution {
  templateName: string;
  variables: string[];
  buttonUrl: string;
}

function formatDate(iso: string): string {
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

/**
 * Resolve WhatsApp template name and variables for a given event.
 * Returns null if the event type has no WhatsApp template.
 */
async function resolveTemplate(
  sc: SupabaseClient,
  eventType: string,
  payload: Record<string, unknown>,
  ctx: NotifyContext,
): Promise<TemplateResolution | null> {
  const dayworkId = payload.daywork_id as string | undefined;
  const engagementId = payload.engagement_id as string | undefined;
  const postingId = payload.permanent_posting_id as string | undefined;

  switch (eventType) {
    case 'DAYWORK.APPLIED': {
      const jobNumber = dayworkId ? await getJobNumber(sc, dayworkId) : 'a daywork';
      const { data: dw } = dayworkId
        ? await sc
            .from('dayworks')
            .select('role_id, yacht_roles(name)')
            .eq('id', dayworkId)
            .single()
        : { data: null };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const roleName = (dw as any)?.yacht_roles?.name ?? 'a role';
      const { count } = dayworkId
        ? await sc
            .from('applications')
            .select('id', { count: 'exact', head: true })
            .eq('daywork_id', dayworkId)
        : { count: 0 };
      return {
        templateName: 'dw_new_applicant',
        variables: [roleName, jobNumber, String(count ?? 0), dayworkId ?? ''],
        buttonUrl: `${SITE_URL}/daywork/${dayworkId}/review`,
      };
    }

    case 'DAYWORK.ACCEPTED': {
      const jobNumber = dayworkId ? await getJobNumber(sc, dayworkId) : 'a daywork';
      const { data: dw } = dayworkId
        ? await sc
            .from('dayworks')
            .select(
              'start_date, end_date, vessel_id, location_port_id, yacht_roles:role_id(name), vessels:vessel_id(name, nda_flag), ports:location_port_id(name)',
            )
            .eq('id', dayworkId)
            .single()
        : { data: null };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const d = dw as any;
      const roleName = d?.yacht_roles?.name ?? 'a role';
      const vesselName = d?.vessels?.nda_flag ? 'NDA Vessel' : (d?.vessels?.name ?? 'a vessel');
      const portName = d?.ports?.name ?? 'port TBC';
      const startDate = d?.start_date ? formatDate(d.start_date) : 'TBC';
      const endDate = d?.end_date ? formatDate(d.end_date) : 'TBC';
      return {
        templateName: 'dw_accepted',
        variables: [roleName, jobNumber, vesselName, portName, startDate, endDate],
        buttonUrl: `${SITE_URL}/messages/${engagementId ?? ''}`,
      };
    }

    case 'DAYWORK.REJECTED': {
      const jobNumber = dayworkId ? await getJobNumber(sc, dayworkId) : 'a daywork';
      const { data: dw } = dayworkId
        ? await sc.from('dayworks').select('yacht_roles:role_id(name)').eq('id', dayworkId).single()
        : { data: null };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const roleName = (dw as any)?.yacht_roles?.name ?? 'a role';
      return {
        templateName: 'dw_rejected',
        variables: [roleName, jobNumber],
        buttonUrl: `${SITE_URL}/discover`,
      };
    }

    case 'DAYWORK.SHORTLISTED': {
      const jobNumber = dayworkId ? await getJobNumber(sc, dayworkId) : 'a daywork';
      const { data: dw } = dayworkId
        ? await sc
            .from('dayworks')
            .select('yacht_roles:role_id(name), ports:location_port_id(name)')
            .eq('id', dayworkId)
            .single()
        : { data: null };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const d = dw as any;
      return {
        templateName: 'dw_shortlisted',
        variables: [d?.yacht_roles?.name ?? 'a role', jobNumber, d?.ports?.name ?? 'a port'],
        buttonUrl: `${SITE_URL}/discover`,
      };
    }

    case 'DAYWORK.INVITED': {
      const jobNumber = dayworkId ? await getJobNumber(sc, dayworkId) : 'a daywork';
      const { data: dw } = dayworkId
        ? await sc
            .from('dayworks')
            .select(
              'start_date, end_date, day_rate, currency, yacht_roles:role_id(name), vessels:vessel_id(name, nda_flag), ports:location_port_id(name)',
            )
            .eq('id', dayworkId)
            .single()
        : { data: null };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const d = dw as any;
      const vesselName = d?.vessels?.nda_flag ? 'NDA Vessel' : (d?.vessels?.name ?? 'a vessel');
      const sym =
        d?.currency === 'GBP'
          ? '£'
          : d?.currency === 'USD'
            ? '$'
            : d?.currency === 'AED'
              ? 'د.إ'
              : '€';
      return {
        templateName: 'dw_invited',
        variables: [
          d?.yacht_roles?.name ?? 'a role',
          jobNumber,
          d?.ports?.name ?? 'a port',
          vesselName,
          `${sym}${d?.day_rate ?? ''}`,
          d?.start_date ? formatDate(d.start_date) : 'TBC',
          d?.end_date ? formatDate(d.end_date) : 'TBC',
        ],
        buttonUrl: `${SITE_URL}/discover`,
      };
    }

    case 'DAYWORK.INVITATION_ACCEPTED': {
      const jobNumber = dayworkId ? await getJobNumber(sc, dayworkId) : 'a daywork';
      const { data: dw } = dayworkId
        ? await sc.from('dayworks').select('yacht_roles:role_id(name)').eq('id', dayworkId).single()
        : { data: null };

      return {
        templateName: 'dw_invitation_accepted',
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        variables: [(dw as any)?.yacht_roles?.name ?? 'a role', jobNumber],
        buttonUrl: `${SITE_URL}/messages/${engagementId ?? ''}`,
      };
    }

    case 'DAYWORK.COMPLETED': {
      const jobNumber = dayworkId ? await getJobNumber(sc, dayworkId) : 'a daywork';
      const { data: dw } = dayworkId
        ? await sc.from('dayworks').select('yacht_roles:role_id(name)').eq('id', dayworkId).single()
        : { data: null };

      return {
        templateName: 'dw_completed',
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        variables: [(dw as any)?.yacht_roles?.name ?? 'a role', jobNumber],
        buttonUrl: `${SITE_URL}/messages/${engagementId ?? ''}`,
      };
    }

    case 'PERMANENT.APPLIED': {
      if (!postingId) return null;
      const info = await getPermanentPostingInfo(sc, postingId);
      if (!info) return null;
      const crewName = await getDisplayName(sc, payload.crew_person_id as string);
      const { count } = await sc
        .from('applications')
        .select('id', { count: 'exact', head: true })
        .eq('permanent_posting_id', postingId);
      return {
        templateName: 'pm_new_applicant',
        variables: [crewName, info.role_name, info.job_number, String(count ?? 0)],
        buttonUrl: `${SITE_URL}/permanent/${postingId}/review`,
      };
    }

    case 'PERMANENT.SHORTLISTED': {
      if (!postingId) return null;
      const info = await getPermanentPostingInfo(sc, postingId);
      if (!info) return null;
      const { data: pp } = await sc
        .from('permanent_postings')
        .select('ports:port_id(name)')
        .eq('id', postingId)
        .single();

      return {
        templateName: 'pm_shortlisted',
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        variables: [info.role_name, info.job_number, (pp as any)?.ports?.name ?? 'a port'],
        buttonUrl: `${SITE_URL}/discover`,
      };
    }

    case 'PERMANENT.SELECTED': {
      if (!postingId) return null;
      const info = await getPermanentPostingInfo(sc, postingId);
      if (!info) return null;
      const { data: pp } = await sc
        .from('permanent_postings')
        .select('vessel_id, ports:port_id(name), vessels:vessel_id(name, nda_flag)')
        .eq('id', postingId)
        .single();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const d = pp as any;
      const vesselName = d?.vessels?.nda_flag ? 'NDA Vessel' : (d?.vessels?.name ?? 'a vessel');
      return {
        templateName: 'pm_selected',
        variables: [info.role_name, info.job_number, vesselName, d?.ports?.name ?? 'a port'],
        buttonUrl: `${SITE_URL}/messages/${engagementId ?? ''}`,
      };
    }

    case 'PERMANENT.REJECTED': {
      if (!postingId) return null;
      const info = await getPermanentPostingInfo(sc, postingId);
      if (!info) return null;
      return {
        templateName: 'pm_rejected',
        variables: [info.role_name, info.job_number],
        buttonUrl: `${SITE_URL}/discover`,
      };
    }

    case 'PERMANENT.PLACEMENT_CONFIRMED': {
      if (!postingId) return null;
      const info = await getPermanentPostingInfo(sc, postingId);
      if (!info) return null;
      // Distinguish placed crew vs not-selected applicants by notification title
      if (ctx.notification.title === 'Position Filled') {
        return {
          templateName: 'pm_position_filled',
          variables: [info.role_name, info.job_number],
          buttonUrl: `${SITE_URL}/discover`,
        };
      }
      return {
        templateName: 'pm_placement_confirmed',
        variables: [info.role_name, info.job_number],
        buttonUrl: `${SITE_URL}/messages/${engagementId ?? ''}`,
      };
    }

    case 'PERMANENT.CANCELLED_BY_EMPLOYER': {
      if (!postingId) return null;
      const info = await getPermanentPostingInfo(sc, postingId);
      if (!info) return null;
      return {
        templateName: 'pm_posting_cancelled',
        variables: [info.role_name, info.job_number],
        buttonUrl: `${SITE_URL}/discover`,
      };
    }

    case 'MESSAGE.SENT': {
      const eid = engagementId ?? (payload.engagement_id as string);
      if (!eid) return null;
      const { data: eng } = await sc
        .from('active_engagements')
        .select('daywork_id, permanent_posting_id')
        .eq('id', eid)
        .single();
      if (!eng) return null;
      let roleName = 'a role';
      let jobNumber = 'a job';
      if (eng.daywork_id) {
        jobNumber = await getJobNumber(sc, eng.daywork_id);
        const { data: dw } = await sc
          .from('dayworks')
          .select('yacht_roles:role_id(name)')
          .eq('id', eng.daywork_id)
          .single();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        roleName = (dw as any)?.yacht_roles?.name ?? 'a role';
      } else if (eng.permanent_posting_id) {
        const info = await getPermanentPostingInfo(sc, eng.permanent_posting_id);
        if (info) {
          roleName = info.role_name;
          jobNumber = info.job_number;
        }
      }
      return {
        templateName: 'eng_message',
        variables: [roleName, jobNumber],
        buttonUrl: `${SITE_URL}/messages/${eid}`,
      };
    }

    case 'ENGAGEMENT.WORK_STARTED':
    case 'ENGAGEMENT.WORK_STARTED_CONFIRMED':
    case 'ENGAGEMENT.CANCELLED_BY_CREW':
    case 'ENGAGEMENT.CANCELLED_BY_EMPLOYER':
    case 'ENGAGEMENT.POSTPONEMENT_PROPOSED':
    case 'ENGAGEMENT.COMPLETION_CONFIRMED':
    case 'CHECKLIST.SET': {
      const eid = engagementId ?? (payload.engagement_id as string);
      if (!eid) return null;
      const { data: eng } = await sc
        .from('active_engagements')
        .select('daywork_id, permanent_posting_id')
        .eq('id', eid)
        .single();
      if (!eng) return null;
      let roleName = 'a role';
      let jobNumber = 'a job';
      if (eng.daywork_id) {
        jobNumber = await getJobNumber(sc, eng.daywork_id);
        const { data: dw } = await sc
          .from('dayworks')
          .select('yacht_roles:role_id(name)')
          .eq('id', eng.daywork_id)
          .single();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        roleName = (dw as any)?.yacht_roles?.name ?? 'a role';
      } else if (eng.permanent_posting_id) {
        const info = await getPermanentPostingInfo(sc, eng.permanent_posting_id);
        if (info) {
          roleName = info.role_name;
          jobNumber = info.job_number;
        }
      }
      const templateMap: Record<string, string> = {
        'ENGAGEMENT.WORK_STARTED': 'eng_work_started',
        'ENGAGEMENT.WORK_STARTED_CONFIRMED': 'eng_work_confirmed',
        'ENGAGEMENT.CANCELLED_BY_CREW': 'eng_cancelled_by_crew',
        'ENGAGEMENT.CANCELLED_BY_EMPLOYER': 'eng_cancelled_by_employer',
        'ENGAGEMENT.POSTPONEMENT_PROPOSED': 'eng_postponement',
        'ENGAGEMENT.COMPLETION_CONFIRMED': 'eng_completed',
        'CHECKLIST.SET': 'eng_checklist',
      };
      return {
        templateName: templateMap[eventType] ?? 'eng_message',
        variables: [roleName, jobNumber],
        buttonUrl: `${SITE_URL}/messages/${eid}`,
      };
    }

    default:
      return null;
  }
}

/**
 * Check if the recipient has a verified WhatsApp channel with whatsapp_enabled.
 * Returns the encrypted phone buffer or null.
 */
export async function getWhatsAppChannel(
  sc: SupabaseClient,
  recipientPersonId: string,
): Promise<Buffer | null> {
  const { data: channel } = await sc
    .from('notification_channels')
    .select('channel_value_encrypted, verified')
    .eq('person_id', recipientPersonId)
    .eq('channel_type', 'whatsapp')
    .eq('verified', true)
    .single();

  if (!channel) return null;

  // Check whatsapp_enabled preference
  const { data: prefs } = await sc
    .from('user_preferences')
    .select('whatsapp_enabled')
    .eq('person_id', recipientPersonId)
    .single();

  if (prefs && prefs.whatsapp_enabled === false) return null;

  return Buffer.from(channel.channel_value_encrypted);
}

/**
 * Send WhatsApp notification for an event. Returns true if sent successfully.
 */
export async function sendWhatsAppForEvent(
  sc: SupabaseClient,
  eventType: string,
  payload: Record<string, unknown>,
  ctx: NotifyContext,
  phoneEncrypted: Buffer,
): Promise<boolean> {
  const template = await resolveTemplate(sc, eventType, payload, ctx);
  if (!template) return false;

  return sendWhatsApp(
    phoneEncrypted,
    template.templateName,
    template.variables,
    template.buttonUrl,
  );
}
