import type { LlmGeneratedContent } from "@/lib/contracts";

export const staticExplanationVariants: Record<string, LlmGeneratedContent> = {
  velocity: {
    analystExplanation:
      "The dominant factor is transaction velocity. Five linked accounts moved similar round-value payments through reciprocal paths inside a short time window. Removing the velocity signal reduces the observed risk materially, which is consistent with coordinated mule-account layering rather than independent customer activity.",
    eli70Explanation:
      "We found five accounts passing money between one another very quickly. It looks less like ordinary payments and more like people moving money around together to hide where it came from. We have paused the case so a person can check it safely.",
    complaintBody:
      "I request that the Cyber Crime authorities review a suspected coordinated UPI mule-account network. The monitored accounts transferred repeated round-value payments among five linked accounts within a compressed time window. FraudLens preserved the transaction references, account links and risk explanation for investigation.",
  },
  layering: {
    analystExplanation:
      "The dominant factor is layering behaviour. Funds were routed through a compact, reciprocating five-account cluster across multiple hops, obscuring origin and destination. The network pattern remains suspicious even where individual transfers do not independently exceed the naive threshold.",
    eli70Explanation:
      "Money was being passed around a small group of accounts, then sent on again. That can be a way to make dirty money look ordinary. Looking at the whole group lets us see something a single payment cannot show.",
    complaintBody:
      "I wish to report suspected UPI layering through a connected five-account mule network. The accounts show repeated multi-hop transfers and reciprocal movement designed to obscure the path of funds. Please preserve related payment records and investigate the linked VPA identifiers.",
  },
  beneficiary: {
    analystExplanation:
      "The principal transactional indicator is a high-value payment to a newly introduced beneficiary, amplified by the recipient's connection to a dense account cluster. This pairing merits investigation because beneficiary novelty and value are atypical when observed with the network evidence.",
    eli70Explanation:
      "A large payment went to someone new, and that account is connected to a group that is already behaving strangely. We are checking it carefully before more money can move.",
    complaintBody:
      "I request review of a high-value UPI transfer to a newly added beneficiary that is linked to a suspected mule cluster. The account relationship map and transaction details have been retained to assist follow-up action.",
  },
  structuring: {
    analystExplanation:
      "The strongest contributor is structuring: repeated round-value transfers were arranged across related accounts in a way that avoids a single conspicuous payment. The repeated pattern, together with network centrality, supports a coordinated-risk assessment.",
    eli70Explanation:
      "The payments were split into many neat, similar amounts and passed among connected accounts. Doing that can be a way to hide one larger problem, so we have marked the group for review.",
    complaintBody:
      "I request investigation into suspected structured UPI transfers across linked accounts. Repeated round-value payments and the connected account graph indicate possible coordinated movement of funds intended to avoid detection.",
  },
};

let fallbackSequence = 0;

const rotatingOpeners: Record<string, Array<Pick<LlmGeneratedContent, "analystExplanation" | "eli70Explanation" | "complaintBody">>> = {
  velocity: [
    { analystExplanation: "Timing analysis shows several transfers arriving in a compressed interval across the same linked accounts.", eli70Explanation: "These accounts moved money much faster than ordinary people usually do.", complaintBody: "The time pattern indicates unusually compressed UPI movement across the linked accounts." },
    { analystExplanation: "The review found repeated short-interval handoffs that create a coordinated movement signature.", eli70Explanation: "The payments were handed from one account to another in a hurry.", complaintBody: "The retained records show repeated short-interval handoffs between the named accounts." },
    { analystExplanation: "Transaction timestamps cluster tightly enough to make independent customer behaviour less likely.", eli70Explanation: "The payments happened close together, like the accounts were working together.", complaintBody: "Timestamp clustering across the linked VPAs is retained as supporting evidence." },
  ],
  layering: [
    { analystExplanation: "Path analysis found money revisiting a compact set of accounts through several short hops.", eli70Explanation: "The money took a roundabout route through the same small group.", complaintBody: "The graph preserves multi-hop paths through a compact set of linked accounts." },
    { analystExplanation: "The connected transfers form a relay pattern rather than isolated customer payments.", eli70Explanation: "The accounts appear to be passing money along like a relay team.", complaintBody: "The linked transaction paths show a relay-like movement pattern for review." },
    { analystExplanation: "Reciprocal account paths keep obscuring the original sender and destination relationship.", eli70Explanation: "It is hard to tell where the money started because it keeps circling through the group.", complaintBody: "Reciprocal paths that obscure origin and destination have been retained for review." },
  ],
  beneficiary: [
    { analystExplanation: "A high-value first-time recipient is connected to an account cluster with elevated relationship risk.", eli70Explanation: "A large payment went to someone new who is linked to a worrying group.", complaintBody: "The evidence includes a high-value payment to a newly introduced linked beneficiary." },
    { analystExplanation: "Recipient novelty and payment value arrive together in a network already under heightened review.", eli70Explanation: "A new account received a lot of money while the connected group looked unusual.", complaintBody: "Recipient novelty and high value were recorded alongside linked network evidence." },
    { analystExplanation: "The beneficiary was newly observed and immediately participated in a dense relationship pattern.", eli70Explanation: "This new account quickly became part of a group that was moving money strangely.", complaintBody: "The new beneficiary's immediate participation in the linked network was retained." },
  ],
  structuring: [
    { analystExplanation: "Repeated round-value transfers distribute exposure across several related accounts.", eli70Explanation: "The money was split into neat, similar amounts across connected accounts.", complaintBody: "Repeated round-value transfers across connected accounts are preserved as evidence." },
    { analystExplanation: "Similar payment amounts recur across the cluster instead of appearing as one ordinary standalone transfer.", eli70Explanation: "The payments look very similar, which can be a sign someone is trying to hide a bigger move.", complaintBody: "Similar recurring amounts were observed across the linked UPI cluster." },
    { analystExplanation: "The amount pattern is consistent with subdivision of a larger movement into less conspicuous transfers.", eli70Explanation: "The money may have been broken into smaller pieces to make it less noticeable.", complaintBody: "The transaction amounts show a possible subdivision pattern for investigator review." },
  ],
};

export function staticContentFor(signal: string): LlmGeneratedContent {
  const normalized = signal.toLowerCase();
  const key = normalized.includes("velocity") ? "velocity"
    : normalized.includes("layer") ? "layering"
      : normalized.includes("beneficiary") ? "beneficiary" : "structuring";
  const base = staticExplanationVariants[key];
  const opener = rotatingOpeners[key][fallbackSequence++ % rotatingOpeners[key].length];
  return {
    analystExplanation: `${opener.analystExplanation} ${base.analystExplanation}`,
    eli70Explanation: `${opener.eli70Explanation} ${base.eli70Explanation}`,
    complaintBody: `${opener.complaintBody} ${base.complaintBody}`,
  };
}
