import * as React from 'react';
import styles from './Leads.module.scss';
import { ILeadsProps, ILeadsState, LeadView } from '.';
import { LeadCardActions, LeadCardPreview } from '..';
import { Dropdown } from 'office-ui-fabric-react/lib/Dropdown';
import { Spinner, SpinnerSize } from 'office-ui-fabric-react/lib/Spinner';
import { css } from 'office-ui-fabric-react/lib/Utilities';
import { DocumentCard, DocumentCardTitle, DocumentCardActivity, DocumentCardLocation, IDocumentCardActivityPerson } from 'office-ui-fabric-react/lib/DocumentCard';
import { Dialog, DialogType, DialogFooter } from 'office-ui-fabric-react/lib/Dialog';
import { ImageFit } from 'office-ui-fabric-react/lib/Image';
import { Icon } from 'office-ui-fabric-react/lib/Icon';
import { HttpClient, HttpClientResponse } from '@microsoft/sp-http';
import { Placeholder } from "@pnp/spfx-controls-react/lib/Placeholder";
import { SampleLeads } from '../../../../SampleLeads';
import { LeadComment, Lead, Person } from '../../../../Lead';

export class Leads extends React.Component<ILeadsProps, ILeadsState> {
  constructor(props: ILeadsProps) {
    super(props);

    this.state = {
      loading: false,
      error: undefined,
      leads: [],
      submitCardDialogVisible: false,
      view: typeof props.view !== 'undefined' ? props.view : LeadView.new
    };
  }

  private loadLeads(view: LeadView): void {
    if (this.props.needsConfiguration) {
      return;
    }

    this.setState({
      loading: true,
      error: undefined
    });

    this
      .getData()
      .then((data: Lead[]): void => {
        let leads: Lead[] = data;
        switch (view) {
          case LeadView.new:
            leads = data.sort((a, b) => (b.createdOn as any) - (a.createdOn as any));
            break;
          case LeadView.mostProbable:
            leads = data.sort((a, b) => b.percentComplete - a.percentComplete);
            break;
          case LeadView.recentComments:
            leads = data.sort((a, b) => (this.getLastCommentDate(b) as any) - (this.getLastCommentDate(a) as any));
            break;
          case LeadView.requireAttention:
            leads = data.filter(l => l.requiresAttention === true);
            break;
        }

        this.setState({
          loading: false,
          leads: leads
        });
      }, (error: any): void => {
        this.setState({
          loading: false,
          error: error
        });
      });
  }

  private getData(): Promise<Lead[]> {
    if (this.props.demo) {
      return Promise.resolve(SampleLeads.leads);
    }
    else {
      return this.props.httpClient.get(this.props.leadsApiUrl, HttpClient.configurations.v1)
        .then((res: HttpClientResponse) => res.json());
    }
  }

  private getLastCommentDate(lead: Lead): Date {
    let date: Date = new Date(0);

    if (lead.comments && lead.comments.length > 0) {
      date = new Date(lead.comments[lead.comments.length - 1].date);
    }

    return date;
  }

  private viewChanged = (item): void => {
    this.setState({
      view: item.data
    });
    this.loadLeads(item.data);
  }

  private leadClicked = (ev?: React.SyntheticEvent<HTMLElement>): void => {
    if (!this.props.teamsContext ||
      !this.props.host ||
      !this.props.host._teamsManager ||
      !this.props.host._teamsManager._appContext ||
      !this.props.host._teamsManager._appContext.applicationName) {
      return;
    }

    const host: string = this.props.host._teamsManager._appContext.applicationName;
    if (host !== 'TeamsTaskModuleApplication') {
      return;
    }

    const leadElement: HTMLElement = ev.currentTarget;
    const leadId: string = leadElement.dataset.leadid;
    if (!leadId) {
      return;
    }

    const selectedLead: Lead[] = this.state.leads.filter(lead => lead.id === leadId);
    if (selectedLead.length < 1) {
      return;
    }

    this.setState({ submitCardDialogVisible: true });
    this.props.teamsContext.tasks.submitTask(selectedLead[0]);
  }

  private leadShared = (): void => {
  }

  private leadFollowed = (): void => {
  }

  public componentDidMount(): void {
    this.loadLeads(this.state.view);
  }

  public componentDidUpdate(prevProps: ILeadsProps, prevState: ILeadsState, snapshot?: any): void {
    if (this.props.demo !== prevProps.demo) {
      this.loadLeads(this.state.view);
    }
  }

  private getCommentsForCard(comments: LeadComment[]): any {
    return comments.map(c => {
      return {
        name: c.comment,
        url: '#',
        previewImageSrc: '',
        iconSrc: SampleLeads.getPhotoUrl(c.createdBy.email),
        imageFit: ImageFit.cover,
        width: 318,
        height: 196
      };
    });
  }

  private getDisplayDate(d: string): string {
    const date: Date = new Date(d);
    let displayDate: string = date.toLocaleDateString();
    const dateYear: number = date.getFullYear();
    const now: Date = new Date();

    if (dateYear === now.getFullYear()) {
      displayDate = displayDate.replace(dateYear.toString(), '').replace(/(^[^\d]|[^\d]$)/g, '');
    }

    return displayDate;
  }

  private getDistinctContributors(createdBy: Person, comments: LeadComment[]): Person[] {
    const contributors: Person[] = [];

    comments.forEach(c => {
      if (c.createdBy.email === createdBy.email) {
        return;
      }

      for (let i: number = 0; i < contributors.length; i++) {
        if (contributors[i].email === c.createdBy.email) {
          return;
        }
      }

      contributors.push(c.createdBy);
    });

    return contributors;
  }

  public render(): React.ReactElement<ILeadsProps> {
    const { error, loading, leads, view, submitCardDialogVisible } = this.state;
    const { needsConfiguration } = this.props;

    if (needsConfiguration) {
      return <div className={css(styles.leads, 'ms-Fabric')}>
        <Placeholder
          iconName='Chart'
          iconText='Configure your environment'
          description='The required LeadsApiUrl tenant property is not configured. Please configure the property before using this web part.' />
      </div>;
    }

    return (
      <div className={css(styles.leads, 'ms-Fabric')}>
        {loading &&
          <Spinner label='Loading Leads...' size={SpinnerSize.large} />}
        {!loading &&
          error &&
          <div>The following error has occurred while loading Leads: {this.state.error}</div>}
        {!loading &&
          !error &&
          leads.length === 0 &&
          <div>No Leads found</div>}
        {!loading &&
          !error &&
          leads.length > 0 &&
          <div>
            <div className={styles.viewWrapper}>
              <div className={styles.title}>Leads from the Lead Management System</div>
              {typeof this.props.view === 'undefined' &&
                <Dropdown
                  placeHolder='Select view'
                  className={styles.view}
                  options={
                    [
                      { key: 'new', text: 'New Leads', data: LeadView.new },
                      { key: 'mostProbable', text: 'Most probable', data: LeadView.mostProbable },
                      { key: 'recentComments', text: 'Recently commented', data: LeadView.recentComments },
                      { key: 'requireAttention', text: 'Require attention', data: LeadView.requireAttention }
                    ]
                  }
                  selectedKey={LeadView[view]}
                  onChanged={this.viewChanged} />
              }
            </div>
            <div className={styles.cards}>
              {
                leads.map(l =>
                  <DocumentCard onClick={this.leadClicked} className={styles.card} key={l.id} data-leadid={l.id}>
                    <div className={styles.cardContents}>
                      <div>
                        <LeadCardPreview previewItems={this.getCommentsForCard(l.comments.reverse())} />
                        {l.requiresAttention === true &&
                          <Icon iconName='Info' className={styles.urgent} />}
                        <DocumentCardLocation location={l.account} locationHref='#' />
                        <DocumentCardTitle title={l.title} shouldTruncate={true} />
                        <div className={styles.titleSecondary}><DocumentCardTitle title={l.description!} shouldTruncate={true} /></div>
                      </div>
                      <div>
                        <DocumentCardActivity
                          activity={`Created ${this.getDisplayDate(l.createdOn)}`}
                          people={
                            ([] as IDocumentCardActivityPerson[])
                              .concat([{ name: l.createdBy.name, profileImageSrc: SampleLeads.getPhotoUrl(l.createdBy.email) }])
                              .concat(this.getDistinctContributors(l.createdBy, l.comments).map(c => {
                                return {
                                  name: c.name,
                                  profileImageSrc: SampleLeads.getPhotoUrl(c.email)
                                };
                              }))
                          }
                        />
                        <LeadCardActions
                          actions={
                            [
                              {
                                iconProps: { iconName: 'Share' },
                                onClick: this.leadShared,
                                ariaLabel: 'Share Lead'
                              },
                              {
                                iconProps: { iconName: 'View' },
                                onClick: this.leadFollowed,
                                ariaLabel: 'Follow Lead'
                              }
                            ]
                          }
                          percentComplete={l.percentComplete}
                          change={l.change} />
                      </div>
                    </div>
                  </DocumentCard>
                )
              }
            </div>
            <Dialog
              hidden={!submitCardDialogVisible}
              dialogContentProps={{
                type: DialogType.normal,
                title: 'Loading data'
              }}
              styles={{
                main: [{
                  selectors: {
                    ['@media (min-width: 480px)']: {
                      minWidth: '500px',
                      minHeight: '200px'
                    }
                  }
                }]
              }}
              modalProps={{
                isBlocking: true,
                dragOptions: undefined,
              }}>
              <Spinner label='Loading data from the Lead Management System...' labelPosition='right' size={SpinnerSize.large} style={{margin: '2em auto'}} />
            </Dialog>
          </div>
        }
      </div>
    );
  }
}
