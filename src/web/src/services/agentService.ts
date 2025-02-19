/**
 * Service class for managing AI agents through the backend API
 * Provides comprehensive error handling, monitoring, and caching
 * @version 1.0.0
 */

import { httpClient } from './httpClient';
import { AGENT_ENDPOINTS } from '../constants/apiEndpoints';
import { Agent, AgentConfig, CreateAgentRequest, UpdateAgentRequest, AgentStatus, agentConfigSchema } from '../types/agent.types';
import { ApiResponse, ApiError } from '../types/api.types';
import retry from 'axios-retry'; // ^3.5.0
import NodeCache from 'node-cache'; // ^5.1.2
import winston from 'winston'; // ^3.8.0

class AgentService {
  private cache: NodeCache;
  private logger: winston.Logger;
  private static readonly CACHE_TTL = 300; // 5 minutes
  private static readonly METRICS_CACHE_TTL = 60; // 1 minute

  constructor() {
    // Initialize cache with TTL and checking period
    this.cache = new NodeCache({
      stdTTL: AgentService.CACHE_TTL,
      checkperiod: 60,
      useClones: false
    });

    // Initialize logger
    this.logger = winston.createLogger({
      level: 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      ),
      transports: [
        new winston.transports.Console(),
        new winston.transports.File({ filename: 'agent-service.log' })
      ]
    });
  }

  /**
   * Retrieves a list of all agents with caching
   * @returns Promise<Agent[]> List of agents
   */
  public async getAgents(): Promise<Agent[]> {
    const cacheKey = 'agents_list';
    const cachedAgents = this.cache.get<Agent[]>(cacheKey);

    if (cachedAgents) {
      this.logger.debug('Retrieved agents from cache');
      return cachedAgents;
    }

    try {
      const response = await httpClient.get<Agent[]>(AGENT_ENDPOINTS.BASE);
      this.cache.set(cacheKey, response.data);
      
      this.logger.info('Successfully retrieved agents from API', {
        count: response.data.length
      });
      
      return response.data;
    } catch (error) {
      this.logger.error('Failed to retrieve agents', { error });
      throw this.handleError(error);
    }
  }

  /**
   * Retrieves a specific agent by ID
   * @param id Agent identifier
   * @returns Promise<Agent>
   */
  public async getAgentById(id: string): Promise<Agent> {
    const cacheKey = `agent_${id}`;
    const cachedAgent = this.cache.get<Agent>(cacheKey);

    if (cachedAgent) {
      this.logger.debug('Retrieved agent from cache', { id });
      return cachedAgent;
    }

    try {
      const url = AGENT_ENDPOINTS.GET_BY_ID.replace(':id', id);
      const response = await httpClient.get<Agent>(url);
      this.cache.set(cacheKey, response.data);
      
      this.logger.info('Successfully retrieved agent', { id });
      return response.data;
    } catch (error) {
      this.logger.error('Failed to retrieve agent', { id, error });
      throw this.handleError(error);
    }
  }

  /**
   * Creates a new agent
   * @param request Agent creation request
   * @returns Promise<Agent>
   */
  public async createAgent(request: CreateAgentRequest): Promise<Agent> {
    try {
      // Validate agent configuration
      agentConfigSchema.parse(request.config);

      const response = await httpClient.post<Agent>(
        AGENT_ENDPOINTS.CREATE,
        request
      );

      this.logger.info('Successfully created agent', {
        id: response.data.id,
        name: response.data.name
      });

      // Invalidate agents list cache
      this.cache.del('agents_list');
      
      return response.data;
    } catch (error) {
      this.logger.error('Failed to create agent', { request, error });
      throw this.handleError(error);
    }
  }

  /**
   * Updates an existing agent
   * @param id Agent identifier
   * @param request Update request
   * @returns Promise<Agent>
   */
  public async updateAgent(id: string, request: UpdateAgentRequest): Promise<Agent> {
    try {
      if (request.config) {
        agentConfigSchema.partial().parse(request.config);
      }

      const url = AGENT_ENDPOINTS.UPDATE.replace(':id', id);
      const response = await httpClient.put<Agent>(url, request);

      // Invalidate relevant caches
      this.cache.del(`agent_${id}`);
      this.cache.del('agents_list');

      this.logger.info('Successfully updated agent', { id });
      return response.data;
    } catch (error) {
      this.logger.error('Failed to update agent', { id, request, error });
      throw this.handleError(error);
    }
  }

  /**
   * Deletes an agent
   * @param id Agent identifier
   * @returns Promise<void>
   */
  public async deleteAgent(id: string): Promise<void> {
    try {
      const url = AGENT_ENDPOINTS.DELETE.replace(':id', id);
      await httpClient.delete<void>(url);

      // Invalidate relevant caches
      this.cache.del(`agent_${id}`);
      this.cache.del('agents_list');

      this.logger.info('Successfully deleted agent', { id });
    } catch (error) {
      this.logger.error('Failed to delete agent', { id, error });
      throw this.handleError(error);
    }
  }

  /**
   * Retrieves agent metrics
   * @param id Agent identifier
   * @returns Promise<AgentMetrics>
   */
  public async getAgentMetrics(id: string): Promise<Agent['metrics']> {
    const cacheKey = `agent_metrics_${id}`;
    const cachedMetrics = this.cache.get<Agent['metrics']>(cacheKey);

    if (cachedMetrics) {
      return cachedMetrics;
    }

    try {
      const url = AGENT_ENDPOINTS.METRICS.replace(':id', id);
      const response = await httpClient.get<Agent['metrics']>(url);
      
      this.cache.set(cacheKey, response.data, AgentService.METRICS_CACHE_TTL);
      return response.data;
    } catch (error) {
      this.logger.error('Failed to retrieve agent metrics', { id, error });
      throw this.handleError(error);
    }
  }

  /**
   * Retrieves agent status
   * @param id Agent identifier
   * @returns Promise<AgentStatus>
   */
  public async getAgentStatus(id: string): Promise<AgentStatus> {
    try {
      const url = AGENT_ENDPOINTS.STATUS.replace(':id', id);
      const response = await httpClient.get<{ status: AgentStatus }>(url);
      return response.data.status;
    } catch (error) {
      this.logger.error('Failed to retrieve agent status', { id, error });
      throw this.handleError(error);
    }
  }

  /**
   * Handles and normalizes service errors
   * @param error Error object
   * @returns ApiError
   */
  private handleError(error: unknown): ApiError {
    if ((error as ApiError).code) {
      return error as ApiError;
    }

    return {
      code: 'AGENT_SERVICE_ERROR',
      message: error instanceof Error ? error.message : 'Unknown error occurred',
      details: {},
      status: 500,
      timestamp: new Date().toISOString(),
      path: '',
      requestId: ''
    };
  }
}

// Export singleton instance
export const agentService = new AgentService();